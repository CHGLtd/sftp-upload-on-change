'use babel';

// Imports
import { CompositeDisposable } from 'atom';

// Node modules
const fs 		= require('fs');
const path 		= require('path');
const chokidar 	= require('chokidar');
const FTP 		= require('ssh2').Client;

export default {

	packageName				:'sftp-upload-on-change',
	configFilename			:null,
	projectPaths 			:null,
	projectConfigFile		:null,
	projectConfigs			:null,
	projectWatchers			:null,
	projectNotifications	:null,
	projectFTP				:null,
	active					:null,
	subscriptions			:null,

	activate() {
		// Initialize variables
		this.configFilename 			= '.' + this.packageName + '.json';
		this.projectPaths 				= atom.project.getPaths();
		this.projectConfigFile		= new Array();
		this.projectConfigs 			= new Array();
		this.projectWatchers 			= new Array();
		this.projectNotifications = new Array();
		this.projectFTP 					= new Array();
		this.active 							= true;

		// Attach listeners to all projects
		this.listen();

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that actives this view
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'ftp-upload-on-change:toggle': () => this.toggle()
		}));
	},

	listen() {
		this.projectPaths.forEach( (project, i) => {
			this.projectConfigFile[i]	= path.join(project, this.configFilename);

			this.projectWatchers[i]		= chokidar.watch(this.projectPaths[i]);

			this.projectWatchers[i].on('ready', () => {

				// Listen to 'add', 'remove' and 'update'
				this.projectWatchers[i].on('add', filePath => {
					if(filePath.split(path.sep).pop() == this.configFilename) {
						this.readConfigFile(i);
					} else if (this.projectConfigs[i]) {
						this.upload(i, filePath);
					}
				}).on('unlink', filePath => {
					// Check for config file
					if(filePath.split(path.sep).pop() == this.configFilename) {
						this.projectConfigs[i] = null;
					} else if (this.projectConfigs[i]) {
						this.delete(i, filePath);
					}
				}).on('change', (filePath, stats) => {
					if(filePath.split(path.sep).pop() == this.configFilename) {
						this.readConfigFile(i);
					} else if(this.projectConfigs[i] && filePath.indexOf(path.join(this.projectPaths[i],this.projectConfigs[i].local.source)) > -1) {
						this.upload(i, filePath, (error) => {
							if(error) {
								this.notification(i, 'error', 'Couldn\'t upload your file: ' + error, {dismissable:true});
							}
						});
					}
				});

				// Read config file
				this.readConfigFile(i);
			});
		});
	},

	stopListening() {
		// Remove all watchers
		this.projectWatchers.forEach( (project, i) => {
			if(this.projectWatchers[i]) this.projectWatchers.close();
		});
	},

	readConfigFile(i) {
		// If project directory isn't the sftp-upload-on-change
		if(this.projectConfigFile[i].indexOf("sftp-upload-on-change") > -1) {
			fs.readFile(this.projectConfigFile[i], (error, data) => {
				if (!error) {
					this.parseConfigFile(i, data);
				} else {
					// If it fails, ask the user if he wants to create a config file
					var options = {
						dismissable: true,
						buttons: [{
							text: 'Yes',
							onDidClick: () => {
								this.createConfigFile(i);
								this.projectNotifications[i].dismiss();
							}
						},{
							text: 'No',
							onDidClick: () => {
								this.projectNotifications[i].dismiss();
							}
						}]
					};
					this.projectNotifications[i] = this.notification(i,'warning','No configuration file present. Do you want me to create one for you?', options);
				}
			});
		}
	},

	parseConfigFile(i, data) {
		try {
			// Parse config file
			this.projectConfigs[i] = JSON.parse(data);

			// TODO: Add config file validations and helper messages in case of error

			// Show notification
			this.notification(i,'success','Listening to ' + this.projectConfigs[i].local.source);
		} catch (e) {
			this.notification(i,'error','Your config file has an error:<br />' + e);
		}
	},

	createConfigFile(i) {
		var source = path.join(__dirname, '..' , this.configFilename);
		this.copyFile(source, this.projectConfigFile[i], (error) => {
			if(error) {
				this.notification(i,'warning','Sorry, but there was an error creating your config file. Maybe it\'s already there?',{ dismissable: true });
				return;
			}

			// Read config file
			this.readConfigFile(i);
		});
	},

	copyFile(source, target, callback) {
		var cbCalled = false;

		var rd = fs.createReadStream(source);
		rd.on("error", function(err) {
			done(err);
		});

		var wr = fs.createWriteStream(target);
		wr.on("error", function(err) {
			done(err);
		});

		wr.on("close", function(ex) {
			done();
		});

		rd.pipe(wr);

		function done(err) {
			if (!cbCalled) {
				callback(err);
				cbCalled = true;
			}
		}
	},

	toggle() {
		console.log("Toggle!");
		this.active = !this.active;

		this.active ? this.listen() : this.stopListening();

		var msg = this.active ? 'Started' : 'Paused';
		var s = '<b>All Projects</b><br/>'+ this.packageName + ': ' + msg;
		atom.notifications.addInfo(s);
	},

	notification(i, type, msg, options) {
		var s = 'Project <b>' + this.projectPaths[i].split(path.sep).pop() + '</b><br/>' + this.packageName + ': ' + msg;
		if(type == 'success') { notification = atom.notifications.addSuccess(s,options); }
		else if(type == 'info') { notification = atom.notifications.addInfo(s,options); }
		else if(type == 'warning') { notification = atom.notifications.addWarning(s,options); }
		else if(type == 'error') { notification = atom.notifications.addError(s,options); }
		else if(type == 'fatal') { notification = atom.notifications.addFatalError(s,options); }
		else { throw 'Wrong notification type!'; }
		return notification;
	},

	upload(i, source, callback) {
		// Get paths
		var localSourceFolder = path.join(this.projectPaths[i],this.projectConfigs[i].local.source);
		var relativeTarget = path.relative(localSourceFolder,source);
		var target = path.join(this.projectConfigs[i].remote.target, relativeTarget);

		// Create new SFTP instance
		var conn = new FTP();
		conn.on('ready', () => {

			conn.sftp( (error, sftp) => {
				if (error) throw err;

				sftp.fastPut(source, target, (error) => {
					if(error) {
						this.notification(i, 'error', 'There was error uploading ' + relativeTarget + ': ' + error);
					} else {
						this.notification(i, 'success', 'Uploaded ' + relativeTarget);
					}
				});
			});
		}).on('error', (error) => {
			conn.end();
			console.log("Closing connection due to error: " + error);
			this.notification(i, 'error', 'Uploading ' + relativeTarget + ' failed due to the following error: ' + error, {dismissable:true});
			this.projectConfigs[i] = null;
		}).connect({
			host: this.projectConfigs[i].remote.host,
			port: this.projectConfigs[i].remote.port,
			username: this.projectConfigs[i].remote.user,
			password: this.projectConfigs[i].remote.pass
		});
	},

	delete(i, source) {
		// Get paths
		var localSourceFolder = path.join(this.projectPaths[i],this.projectConfigs[i].local.source);
		var relativeTarget = path.relative(localSourceFolder,source);
		var target = path.join(this.projectConfigs[i].remote.target, relativeTarget);

		// Create new SFTP instance
		var conn = new FTP();
		conn.on('ready', () => {
			conn.sftp( (error, sftp) => {
				if (error) throw err;

				sftp.unlink(target, (error) => {
					if(error) {
						this.notification(i, 'error', 'There was error removing ' + relativeTarget + ': ' + error);
					} else {
						this.notification(i, 'success', 'Removed ' + relativeTarget);
					}
				});
			});
		}).on('error', (error) => {
			conn.end();
			console.log("Closing connection due to error: " + error);
			this.notification(i, 'error', 'Deleting ' + relativeTarget + ' failed due to the following error: ' + error, {dismissable:true});
			this.projectConfigs[i] = null;
		}).connect({
			host: this.projectConfigs[i].remote.host,
			port: this.projectConfigs[i].remote.port,
			username: this.projectConfigs[i].remote.user,
			password: this.projectConfigs[i].remote.pass
		});
	},

	deactivate() {
		this.packageName = null;
		this.configFilename = null;
		this.projectPaths = null;
		this.projectConfigFile = null;
		this.projectConfigs = null;
		for (var i = 0; i < this.projectWatchers.length; i++) {
			if(this.projectWatchers[i]) this.projectWatchers[i].close();
		}
		this.projectWatchers = null;
		this.projectNotifications = null;
		this.active = null;
		this.subscriptions.dispose();
	},
};
