import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";

export default class MyPlugin extends Plugin {
	statusBarItem: HTMLElement | null = this.addStatusBarItem();

	syncthingInstance: ChildProcessWithoutNullStreams | null = null;
	isSyncthingConnected: boolean = false;
	syncthingLastSyncDate: Date = new Date();

	updateStatusBar(): void {
		if (this.statusBarItem) {
			const connectionStatus = this.isSyncthingConnected ? "🔵" : "⚫";
			const lastSyncTime = this.syncthingLastSyncDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

			this.statusBarItem.setText(`${connectionStatus} Last sync: ${lastSyncTime}`);
		}
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
		const executablePath = this.getAbsolutePath("syncthing.exe");
		this.syncthingInstance = spawn(executablePath, []);

		this.isSyncthingConnected = this.syncthingInstance.pid !== undefined;

		this.syncthingInstance.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		this.syncthingInstance.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
			this.isSyncthingConnected = false;
		});

		this.syncthingInstance.on('exit', (code) => {
			console.log(`child process exited with code ${code}`);
			this.isSyncthingConnected = false;
		});
	}

	getAbsolutePath(fileName: string): string {
        let basePath;
        let relativePath;
        // base path
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }
        // relative path
        relativePath = `${this.app.vault.configDir}/plugins/obsidian-sample-plugin/syncthing/${fileName}`;
        // absolute path
        return `${basePath}/${relativePath}`;
    }
}

