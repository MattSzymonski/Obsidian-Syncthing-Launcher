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
4. In Syncthing GUI available at [127.0.0.1:8384](127.0.0.1:8384) add your vault's directory as new directory to sync.
5. Get ID of added folder and paste it in "Vault folder ID" field of plugin's settings.
6. Get Syncthing API key from Syncthing GUI settins menu and paste it in "Syncthing API key" field of plugin's settings.

## 💡 Other
- Plugin works great as a supplement for [Obsidian Syncthing Integration](https://github.com/LBF38/obsidian-syncthing-integration) plugin.


