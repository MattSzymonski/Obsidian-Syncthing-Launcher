# Obsidian Syncthing Launcher

Obsidian plugin designed to run Syncthing synchronization software directly as a subprocess of Obsidian, providing a convenient solution for users who prefer not to install Syncthing as a standalone application. 

## 🚀 Features
- Embedded Syncthing executable: No separate installation required! The Syncthing integrated within the plugin.
- Syncthing running status: Status indicator located in the bottom-right status bar of Obsidian. The status is represented as:
  - 🔵 Running: Indicates that Syncthing is actively running and your files are being synced.
  - ⚫ Not Running: Indicates that Syncthing is currently not active.
- Last Sync Timestamp: Time of the last successful synchronization directly within the status bar.
- Automatic Syncthing start and close: Syncthing can be started when Obsidian opens and stopped when closed.
- Syncthing in Docker: Plugin can start Syncthing in the Docker container (Docker engine has to be installed)

## 🛠️ Getting Started
1. Download the latest release and unpack it to `<vault_directory>/.obsidian/plugins` directory.  
2. Open Obsidian "Community plugins" tab and enable "Syncthing Launcher".  
3. In the bottom-left corner click the status icon ⚫, Syncthing will start.  
4. In Syncthing GUI available at [127.0.0.1:8384](127.0.0.1:8384):  
- Add your vault's directory as a new directory to sync and add `obsidian-syncthing-launcher-1.0.2` and `syncthing_config` to its "Ignore Patters". 
- Get ID of added folder and paste it in "Vault folder ID" field of plugin's settings.  
- Get Syncthing API key (from settings menu) and paste it in "Syncthing API key" field of plugin's settings.  

### Using Docker
Plugin can run Syncthing in a Docker container to isolate the Obsidian vault directory which Syncthing has access to.  
To enable Docker mode, tick "Use Docker" in plugin's settings before proceeding to step 3.

## 💡 Other
- Plugin works great as a supplement for [Obsidian Syncthing Integration](https://github.com/LBF38/obsidian-syncthing-integration) plugin.


