# Pterodactyl-alt (Windows Native)

[![Logo Image](https://cdn.pterodactyl.io/logos/new/pterodactyl_logo.png)](https://pterodactyl.io)

**Pterodactyl-alt** is a specialized conversion of the Pterodactyl Panel designed to run natively on **Windows**. It removes the requirement for Docker and Linux-specific dependencies, allowing you to host game servers directly on your Windows desktop or server.

## 🚀 Key Features (Windows Edition)

*   **Zero Docker**: No WSL or Docker Desktop required. Everything runs as native Windows processes.
*   **Smart Allocation**: Automatically finds and creates the next available port (e.g., if 25565 is taken, it auto-assigns 25566).
*   **Wings-Win Daemon**: A custom Node.js-based daemon that replaces the Linux Wings daemon.
*   **Resource Management**: Enforces RAM and CPU limits using **Windows Job Objects**.
*   **File Isolation**: Secure folder management using Windows ACLs (Permissions).
*   **Integrated SFTP**: Built-in SFTP server for easy file management via the Panel.

## 🛠️ Quick Start

### 1. Requirements
*   **[PHP 8.3 (x64 Thread Safe)](https://windows.php.net/downloads/releases/archives/php-8.3.30-Win32-vs16-x64.zip)** - Official Zip archive.
*   **[Node.js (LTS)](https://nodejs.org/en/download/prebuilt-installer)** - Standard Windows Installer.
*   **[MariaDB](https://mariadb.org/download/)** - Recommended database.
*   **[Composer](https://getcomposer.org/Composer-Setup.exe)** - Windows Installer for PHP dependencies.

### 2. Detailed Setup Guide

#### **PHP Configuration**
1.  Extract the PHP zip to `C:\php`.
2.  Rename `php.ini-development` to `php.ini`.
3.  Open `php.ini` and enable these extensions (remove the `;`):
    *   `extension=curl`, `fileinfo`, `gd`, `mbstring`, `openssl`, `pdo_mysql`, `sodium`, `zip`
4.  Set `extension_dir = "ext"`.

#### **Windows PATH Setup**
1.  Right-click **`setup_php_path.bat`** and select **"Run as Administrator"**.
2.  Restart any open terminals.

#### **Database Setup (Pick ONE)**
*   **Option A: Local SQLite (Easiest)**
    1.  Run **`3_Setup_Local_Database.bat`**. This creates a local database file and sets everything up automatically.
*   **Option B: MySQL / MariaDB (Professional)**
    1.  Install MariaDB and create a database named `panel`.
    2.  Update your **`.env`** file with your database credentials.
    3.  Run `php artisan migrate --seed`.

### 3. Installation
The easiest way to install is to use the Master Auto-Installer:
1.  Extract the project to your folder.
2.  Right-click **`AUTO_INSTALLER.bat`** and select **"Run as Administrator"**.
3.  Follow the on-screen prompts (it will handle everything for you!).

*(Note: Individual setup scripts are still available in the `install/` folder if you prefer manual control.)*

### 4. Launching
Simply double-click the **`start.bat`** file in the root directory. This will launch:
*   The Panel (Web UI) on `http://localhost:8000`
*   The Wings-Win Daemon on `http://localhost:8080`

## 🧩 How it Works
*   **Panel**: A modified Laravel application with POSIX polyfills and Windows-hardened logic.
*   **Daemon**: A Node.js application that communicates with the Panel API.
*   **JobRunner**: A high-performance C# helper that wraps game processes in Job Objects to manage hardware limits.

## 📜 License
Original Pterodactyl® Copyright © 2015 - 2022 Dane Everitt and contributors.
Windows Native conversion by JustCole.
Code released under the [MIT License](./LICENSE.md).
