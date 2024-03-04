import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import axios from 'axios';

export default class MyPlugin extends Plugin {
	statusBarItem: HTMLElement | null = this.addStatusBarItem();

	syncthingInstance: ChildProcessWithoutNullStreams | null = null;
	syncthingLastSyncDate: string = "no data";

	syncFolderID: string = 'ms-ov';
	syncthingApiKey: string = 'isoDgfErkUr7GSzPTPsMiaHNsJqLvMuS';
	syncthingUrl = 'http://127.0.0.1:8384/';
	updateInterval: number = 5000;

	updateStatusBar(): void {
		this.isSyncthingRunning().then(isRunning => {
			
			if (isRunning) {
				this.getLastSyncDate().then(lastSyncDate => {
					if (lastSyncDate !== null)
					{
						const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };
						const formattedDate = lastSyncDate.toLocaleDateString('en-GB', optionsDate).split( '/' ).reverse( ).join( '.' );

						const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
						const formattedTime = lastSyncDate.toLocaleTimeString('en-GB', optionsTime); 

						this.syncthingLastSyncDate = `${formattedDate} ${formattedTime}`;
					}
					else
					{
						this.syncthingLastSyncDate = "no data";
					}
				});
			}
			
			const connectionStatus = isRunning ? "🔵" : "⚫";
			this.statusBarItem?.setText(`${connectionStatus} Last sync: ${this.syncthingLastSyncDate}`);
		});
	}

	async onload() {
		this.statusBarItem?.onClickEvent((event) => {
			new Notice('Starting Syncthing!');
			this.startSyncthing();
		});

		// Add css class to status bar item
		this.statusBarItem?.addClass('status-bar-item');

		// Update syncthing the status bar item
		this.updateStatusBar();

		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), this.updateInterval)
		);
	}



	onunload() {
		// Kill syncthing if running
		const pid : number | undefined = this.syncthingInstance?.pid;
		if (pid !== undefined) {
			var kill = require('tree-kill');
			kill(pid, 'SIGTERM', (err: any) => {
				if (err) {
					console.error('Failed to kill process tree:', err);
				} else {
					console.log('Process tree killed successfully.');
				}
			});
		}
	}

	startSyncthing() {
		this.isSyncthingRunning().then(isRunning => {
			// Check if already running
			if (isRunning) {
				console.log('Syncthing is already running');
				return;
			}

			// Start
			const executablePath = this.getPluginAbsolutePath() + "syncthing/syncthing.exe";
			this.syncthingInstance = spawn(executablePath, []);
	
			this.syncthingInstance.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`);
			});
	
			this.syncthingInstance.stderr.on('data', (data) => {
				console.error(`stderr: ${data}`);
			});
	
			this.syncthingInstance.on('exit', (code) => {
				console.log(`child process exited with code ${code}`);
			});
		});
	}

	async isSyncthingRunning(): Promise<boolean> {
		const config = {
			headers: {
				'X-API-Key': this.syncthingApiKey,
			}
		};
		
		return axios.get(this.syncthingUrl, config)
			.then(response => true)
			.catch(error => { console.log("Syncthing not running"); return false; });
	}

	getPluginAbsolutePath(): string {
        let basePath;

        // Base path
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }

        // Relative path
        const relativePath = `${this.app.vault.configDir}/plugins/${this.manifest.id}-${this.manifest.version}/`;

        // Absolute path
        return `${basePath}/${relativePath}`;
    }

	async getLastSyncDate() {
		try {
		  const response = await axios.get(this.syncthingUrl + `rest/db/status?folder=${this.syncFolderID}`, {
			headers: {
			  'X-API-Key': this.syncthingApiKey
			}
		  });

		  if (response.data && response.data.stateChanged) {
			return new Date(response.data.stateChanged);
		  } else {
			console.log('No sync data found');
			return null;
		  }
		} catch (error) {
		  console.error('Failed to get last sync date:', error);
		  return null;
		}
	}
}

