# HSE KPI Tracker - Auto-Start Setup

This setup ensures your HSE KPI Tracker automatically starts when the server reboots and restarts if it crashes.

## Quick Setup

1. **Run as Administrator:** Right-click `setup-autostart.bat` and select "Run as administrator"
2. **Restart Computer:** Reboot to test auto-start functionality
3. **Access App:** Go to http://16.171.8.116:8000

## What Gets Installed

### 1. Firewall Rule
- Opens port 8000 for external access
- Allows inbound TCP connections

### 2. Startup Shortcut
- Places shortcut in Windows startup folder
- Launches `run-server.bat` on user login

### 3. Windows Service (Optional)
- Runs as system service
- More reliable than startup shortcut
- Starts before user login

### 4. Task Monitor
- Runs every 5 minutes
- Checks if server is healthy
- Restarts server if it crashes

## Files Created

- `setup-autostart.bat` - Main installation script
- `cleanup-autostart.bat` - Removes all auto-start configs
- `server-monitor.ps1` - Health monitoring script
- `Quick Start HSE KPI Tracker.bat` - Manual launcher
- `server-monitor.log` - Monitoring log file

## Manual Control

### Start Server Manually
- Double-click `Quick Start HSE KPI Tracker.bat`
- Or run `run-server.bat`

### Stop Server
- Close the PHP server window
- Or run: `taskkill /F /IM php.exe`

### Check Status
- Run `diagnose-server.bat`
- Check `server-monitor.log`

## Troubleshooting

### Server Not Accessible
1. Run `diagnose-server.bat`
2. Check firewall settings
3. Verify port 8000 is open

### Auto-Start Not Working
1. Run `setup-autostart.bat` again as Administrator
2. Check Windows Event Viewer for errors
3. Verify PHP and Laravel paths are correct

### Remove Auto-Start
- Run `cleanup-autostart.bat` as Administrator

## Server URLs

- **Frontend:** http://16.171.8.116:8000/
- **API:** http://16.171.8.116:8000/api
- **Local:** http://localhost:8000/

## Requirements

- Windows Server/PC
- Administrator privileges
- PHP 8.5 installed
- Laravel backend configured

## Monitoring

The system monitors:
- Server health (API endpoint)
- Process status
- Network connectivity

Logs are saved to `server-monitor.log` with timestamps.

## Security

- Only opens necessary port (8000)
- Runs with minimal privileges
- No external dependencies
