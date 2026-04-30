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
*   **PHP 8.2 or 8.3** (Thread Safe)
*   **Node.js v20+**
*   **MariaDB / MySQL** (Local or Remote)
*   **Composer**

### 2. Installation
1.  Extract the project to your folder.
2.  Run `composer install --no-dev --optimize-autoloader --ignore-platform-req=ext-posix`.
3.  Run `npm install` inside the `daemon/` folder.
4.  Configure your `.env` file with your database and app settings.
5.  Generate your key: `php artisan key:generate`.

### 3. Launching
Simply double-click the **`start.bat`** file in the root directory. This will launch:
*   The Panel (Web UI) on `http://localhost:8000`
*   The Wings-Win Daemon on `http://localhost:8080`

## 🧩 How it Works
*   **Panel**: A modified Laravel application with POSIX polyfills and Windows-hardened logic.
*   **Daemon**: A Node.js application that communicates with the Panel API.
*   **JobRunner**: A high-performance C# helper that wraps game processes in Job Objects to manage hardware limits.

## 📜 License
Original Pterodactyl® Copyright © 2015 - 2022 Dane Everitt and contributors.
Windows Native conversion by Antigravity.
Code released under the [MIT License](./LICENSE.md).
