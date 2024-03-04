import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import axios from 'axios';

export default class MyPlugin extends Plugin {
	statusBarItem: HTMLElement | null = this.addStatusBarItem();

	syncthingInstance: ChildProcessWithoutNullStreams | null = null;
	syncthingLastSyncDate: Date = new Date();

	syncFolderID: string = 'ms-ov';
	syncthingApiKey: string = 'isoDgfErkUr7GSzPTPsMiaHNsJqLvMuS';
	syncthingUrl = 'http://127.0.0.1:8384/';

	
	updateStatusBar(): void {
		this.isSyncthingRunning().then(isRunning => {
			
			this.syncthingLastSyncDate = new Date();

			const connectionStatus = isRunning ? "🔵" : "⚫";
			const lastSyncTime = this.syncthingLastSyncDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

			this.statusBarItem?.setText(`${connectionStatus} Last sync: ${lastSyncTime}`);
		});
	}

	async onload() {
		this.statusBarItem?.onClickEvent((event) => {
			new Notice('Starting Syncthingx!');
			this.startSyncthing();
			this.getLastSyncDate();
		});

		// Add css class to status bar item
		this.statusBarItem?.addClass('status-bar-item');

		// Update syncthing the status bar item
		this.updateStatusBar();

		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), 1000)
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
        let relativePath;

        // base path
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }

        // relative path
        relativePath = `${this.app.vault.configDir}/plugins/${this.manifest.id}-${this.manifest.version}/`;

        // absolute path
        return `${basePath}/${relativePath}`;
    }

	async getLastSyncDate() {
		try {
		  const response = await axios.get(this.syncthingUrl, {
			headers: {
			  'X-API-Key': this.syncthingApiKey
			}
		  });
	  
		  if (response.data && response.data.lastScan) {
			const lastSyncDate = new Date(response.data.lastScan);
			console.log(`Last sync date for folder ${this.syncFolderID}:`, lastSyncDate);
			return lastSyncDate;
		  } else {
			console.log('No sync data found.');
			return null;
		  }
		} catch (error) {
		  console.error('Failed to get last sync date:', error);
		  return null;
		}
	}
}

