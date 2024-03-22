import { App, FileSystemAdapter, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import { readFileSync, writeFileSync } from 'fs';
import axios from 'axios';

interface Settings {
	syncthingApiKey: string;
	vaultFolderID: string;
	startOnObsidianOpen: boolean;
	stopOnObsidianClose: boolean;
	useDocker: boolean;
}

const DEFAULT_SETTINGS: Settings = {
	syncthingApiKey: '',
	vaultFolderID: '',
	startOnObsidianOpen: false,
	stopOnObsidianClose: false,
	useDocker: false,
}

const UPDATE_INTERVAL = 5000;
const SYNCTHING_CONTAINER_URL = "http://127.0.0.1:8384/";
const SYNCTHING_CORS_PROXY_CONTAINER_URL = "http://127.0.0.1:8380/";

export default class SyncthingLauncher extends Plugin {
	public settings: Settings;

	private vaultPath = "";
	private vaultName = "";

	private syncthingInstance: ChildProcessWithoutNullStreams | null = null;
	private syncthingLastSyncDate: string = "no data";

	private statusBarConnectionIconItem: HTMLElement | null = this.addStatusBarItem();
	private statusBarLastSyncTextItem: HTMLElement | null = this.addStatusBarItem();

	async onload() {
		await this.loadSettings();

		let adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			this.vaultPath = adapter.getBasePath();
			this.vaultName = adapter.getName();
		}

		this.statusBarConnectionIconItem?.addClasses(['status-bar-item', 'status-icon']);
		this.statusBarConnectionIconItem?.setAttribute('data-tooltip-position', 'top');

		this.statusBarConnectionIconItem?.onClickEvent((event) => {
			this.isSyncthingRunning().then(isRunning => {
				if (!isRunning) {
					new Notice('Starting Syncthing!');
					this.startSyncthing();
				}
				else {
					new Notice('Stopping Syncthing!');
					this.stopSyncthing();
				}
			}
		)});

		// Update syncthing the status bar item
		this.updateStatusBar();

		// Register tick interval
		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), UPDATE_INTERVAL)
		);

		// Register settings tab
		this.addSettingTab(new SettingTab(this.app, this));

		// Start syncthing if set in settings
		if (this.settings.startOnObsidianOpen)
		{
			this.startSyncthing();
		}

		// Register on Obsidian close handler 
		window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
	}

	onunload() {
		window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
	}

	// --- Logic ---

	handleBeforeUnload(event: any) {
		// Kill syncthing if running and set in settings
		if (this.settings.stopOnObsidianClose)
		{
			this.stopSyncthing();
		}
	}

	async startSyncthing() {
		this.isSyncthingRunning().then(isRunning => {
			// Check if already running
			if (isRunning) {
				console.log('Syncthing is already running');
				return;
			}

			if (this.settings.useDocker) // Docker
			{
				if (this.checkDockerStatus())
				{
					new Notice('Starting Docker');
					this.startSyncthingDockerStack();
				}
			}
			else // Local Obsidian sub-process
			{
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
			}
		});
	}

	stopSyncthing(): void {

		if (this.settings.useDocker)
		{
			const dockerRunCommand = [
				`docker compose`,
				`-f ${this.getPluginAbsolutePath()}docker/docker-compose.yaml`,
				`stop`,
			];

			exec(dockerRunCommand.join(' '), (error, stdout, stderr) => {
				if (error) {
					console.error('Error:', error.message);
					return false;
				}
				if (stderr) {
					console.log(stderr);
					return false;
				}
	
				console.log('Output:', stdout);
			});
		}
		else
		{
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
	}

	async startSyncthingDockerStack() {
		// Set environment variable
		this.updateEnvFile({
			VAULT_PATH: `${this.vaultPath}`,
			SYNCTHING_CONFIG_PATH: `${this.vaultPath}/.obsidian/syncthing_config`,
		});

		// Run Docker container
		const dockerRunCommand = [
			`docker compose`,
			`-f ${this.getPluginAbsolutePath()}docker/docker-compose.yaml`,
			`up`, 
			`-d`
		];

		exec(dockerRunCommand.join(' '), (error, stdout, stderr) => {
			if (error) {
				console.error('Error:', error.message);
				return false;
			}
			if (stderr) {
				console.log(stderr);
				return false;
			}

			console.log('Output:', stdout);
		});
	};

	updateEnvFile(vars: Record<string, string>) {
		const filePath = `${this.getPluginAbsolutePath()}docker/.env`;
		let content = readFileSync(filePath, 'utf8');
	  
		Object.entries(vars).forEach(([key, value]) => {
		  const regex = new RegExp(`^${key}=.*`, 'm');
		  content = content.replace(regex, `${key}=${value}`);
		});
	  
		writeFileSync(filePath, content, 'utf8');
	  }

	getSyncthingURL(): string {
		return this.settings.useDocker ? SYNCTHING_CORS_PROXY_CONTAINER_URL : SYNCTHING_CONTAINER_URL;
	}

	async isSyncthingRunning(): Promise<boolean> {
		const config = {
			headers: {
				'X-API-Key': this.settings.syncthingApiKey,
			}
		};

		return axios.get(this.getSyncthingURL() , config)
			.then(response => { return true; })
			.catch(error => { console.log("Syncthing status: Not running"); return false; });
	}

	checkDockerStatus(): boolean {
		exec('docker ps', (error, stdout, stderr) => {
			if (error) {
				console.error('Error:', error.message);
				return false;
			}
			if (stderr) {
				console.error('Error:', stderr);
				return false;
			}

			console.log('Output:', stdout);
		});

		return true;
	}

	updateStatusBar(): void {
		this.isSyncthingRunning().then(isRunning => {

			// Display text in status bar
			if (isRunning) {
				this.getLastSyncDate().then(lastSyncDate => {
					if (lastSyncDate !== null)
					{
						const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };
						const formattedDate = lastSyncDate.toLocaleDateString('en-GB', optionsDate).split( '/' ).join( '.' );

						const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
						const formattedTime = lastSyncDate.toLocaleTimeString('en-GB', optionsTime); 

						this.syncthingLastSyncDate = `${formattedDate} ${formattedTime}`;
					}
					else {
						this.syncthingLastSyncDate = "no data";
					}
				});
			}
			
			// Display status icon in status bar
			if (this.statusBarConnectionIconItem) {
				this.statusBarConnectionIconItem.setText(isRunning ? "🔵" : "⚫");
				this.statusBarConnectionIconItem.ariaLabel = isRunning ? "Syncthing connected (click to stop)" : "Click to start Syncthing";
				this.statusBarConnectionIconItem.addClasses(['plugin-editor-status', 'mouse-pointer']);
			}

			if (this.statusBarLastSyncTextItem) {
				this.statusBarLastSyncTextItem.setText(`Last sync: ${this.syncthingLastSyncDate}`);
			}
		});
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
		  const response = await axios.get(this.getSyncthingURL() + `rest/db/status?folder=${this.settings.vaultFolderID}`, {
			headers: {
			  'X-API-Key': this.settings.syncthingApiKey,
			}
		  });

		  if (response.data && response.data.stateChanged) {
			return new Date(response.data.stateChanged);
		  } else {
			console.log(response);
			console.log('No sync data found');
			return null;
		  }
		} catch (error) {
		  console.error('Failed to get last sync date:', error);
		  return null;
		}
	}

	// --- Settings ---

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: SyncthingLauncher;

	constructor(app: App, plugin: SyncthingLauncher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Syncthing API key')
			.setDesc('API key of Syncthing instance (in Syncthing GUI -> Actions -> Settings)')
			.addText(text => text
				.setPlaceholder('Enter Syncthing API key')
				.setValue(this.plugin.settings.syncthingApiKey)
				.onChange(async (value) => {
					this.plugin.settings.syncthingApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Vault folder ID')
			.setDesc('ID of the folder in which the vault is stored (in Syncthing GUI -> Folders -> Vault folder)')
			.addText(text => text
				.setPlaceholder('Enter vault folder ID')
				.setValue(this.plugin.settings.vaultFolderID)
				.onChange(async (value) => {
					this.plugin.settings.vaultFolderID = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Start on Obsidian open')
			.setDesc('Start Syncthing when Obsidian opens')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.startOnObsidianOpen)
				.onChange(async (value) => {
					this.plugin.settings.startOnObsidianOpen = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Stop on Obsidian close')
			.setDesc('Stop Syncthing when Obsidian closes')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.stopOnObsidianClose)
				.onChange(async (value) => {
					this.plugin.settings.stopOnObsidianClose = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use Docker')
			.setDesc('Run Syncthing in Docker container instead of running it locally')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.useDocker)
				.onChange(async (value) => {
					this.plugin.settings.useDocker = value;
					await this.plugin.saveSettings();
				}));
	}
}
