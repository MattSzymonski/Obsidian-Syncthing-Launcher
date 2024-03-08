import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';
import axios from 'axios';
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import { ContainerCreateOptions, Container } from 'dockerode';

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

const SYNCTHING_URL = 'http://127.0.0.1:8384/';
const UPDATE_INTERVAL = 3000;

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
		this.statusBarLastSyncTextItem?.addClass('status-bar-item');

		this.statusBarConnectionIconItem?.onClickEvent((event) => {
			this.isSyncthingRunning().then(isRunning => {
				if (!isRunning) {
					new Notice('Starting Syncthing!');
					this.startSyncthing();
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
	}

	onunload() {
		// Kill syncthing if running and set in settings
		if (this.settings.startOnObsidianOpen)
		{
			this.stopSyncthing();
		}
	}

	// --- Logic ---

	startSyncthing() {
		this.isSyncthingRunning().then(isRunning => {
			// Check if already running
			if (isRunning) {
				console.log('Syncthing is already running');
				return;
			}

			if (this.settings.useDocker) // Docker
			{
				this.checkDockerStatus().then(isRunning => {
					if (isRunning)
					{
						new Notice('Starting Docker');
						this.startDockerContainer();
					}
				})
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

	async startDockerContainer() {
		try {
			// Create a new Docker instance
			const Docker = require('dockerode');
			const docker = new Docker({socketPath: '/var/run/docker.sock'});

			// Define the options for the container
			const containerOptions = {
				name: 'syncthing',
				Hostname: 'syncthing',
				RestartPolicy: {
					Name: 'unless-stopped'
				},
				Env: ['PUID=1000', 'PGID=1000'],
				HostConfig: {
					Binds: [
						`${this.vaultPath}:/var/syncthing/data/obsidian/${this.vaultName}`,
						`${this.vaultPath}/.obsidian/syncthing/config:/var/syncthing/config`,
					]
				},
				PortBindings: {
					'8384': [{ HostPort: '8384' }],
					'22000/tcp': [{ HostPort: '22000' }],
					'22000/udp': [{ HostPort: '22000' }],
					'21027/udp': [{ HostPort: '21027' }]
				}
			};

			docker.createContainer(containerOptions, function(err: any, container: Container) {
				if (err) {
				  console.error('Error creating Syncthing Docker container: ' + err);
				  return;
				}
			  
				container.start(function(err: any, data: any) {
				  if (err) {
					console.error('Error starting Syncthing Docker container: ' + err);
					return;
				  }
				  console.log('Syncthing Docker container started successfully');
				});
			});

			const container = await docker.createContainer(containerOptions);
			await container.start();
			console.log("Container started!");
		} catch (err) {
			console.error("Error starting container:", err);
		}
	};

	async checkDockerStatus(): Promise<boolean> {
		try {
			const { stdout, stderr } = await execAsync('docker ps');
			if (stderr) {
				console.error('Error:', stderr);
				new Notice('Docker is not running');
				return false; // Docker is not running or encountered an error
			}
			console.log('Docker is installed and running');
			return true; // Docker is installed and running
		} catch (error) {
			console.error('Error:', error.message);
			new Notice('Docker is not installed or not running');
			return false; // Docker is not installed or not running
		}
	}

	stopSyncthing(): void {
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

	updateStatusBar(): void {
		this.isSyncthingRunning().then(isRunning => {
			
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
			
			if (this.statusBarConnectionIconItem) {
				this.statusBarConnectionIconItem.setText(isRunning ? "🔵" : "⚫");
				this.statusBarConnectionIconItem.ariaLabel = isRunning ? "Syncthing connected" : "Click to start Syncthing";
				if (isRunning) {
					this.statusBarConnectionIconItem.removeClasses(['plugin-editor-status', 'mouse-pointer']);
				}
				else {
					this.statusBarConnectionIconItem.addClasses(['plugin-editor-status', 'mouse-pointer']);
				}
			}

			if (this.statusBarLastSyncTextItem) {
				this.statusBarLastSyncTextItem.setText(`Last sync: ${this.syncthingLastSyncDate}`);
			}
		});
	}

	async isSyncthingRunning(): Promise<boolean> {
		const config = {
			headers: {
				'X-API-Key': this.settings.syncthingApiKey,
			}
		};
		
		return axios.get(SYNCTHING_URL, config)
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
		  const response = await axios.get(SYNCTHING_URL + `rest/db/status?folder=${this.settings.vaultFolderID}`, {
			headers: {
			  'X-API-Key': this.settings.syncthingApiKey,
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

function execAsync(arg0: string): { stdout: any; stderr: any; } | PromiseLike<{ stdout: any; stderr: any; }> {
	throw new Error('Function not implemented.');
}

