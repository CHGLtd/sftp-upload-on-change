'use babel';

// Imports
import { CompositeDisposable } from 'atom';

// Node modules
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const FTP = require('ssh2').Client;

export default {

	packageName					:'ftp-upload-on-change',
	configFilename				:null,
	projectPaths				:null,
	projectConfigFile			:null,
	projectConfigs				:null,
	projectWatchers				:null,
	projectNotifications		:null,
	projectFTP					:null,
	active						:null,
	subscriptions				:null,

	activate() {
		// Initialize variables
		this.configFilename 			= '.' + this.packageName + '.json';
		this.projectPaths 				= atom.project.getPaths();
		this.projectConfigFile			= new Array();
		this.projectConfigs 			= new Array();
		this.projectWatchers 			= new Array();
		this.projectNotifications 		= new Array();
		this.projectFTP 				= new Array();
		this.active 					= true;

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
						//console.log("A new config file was added!");
					} else {
						this.upload(i, filePath);
					}
				}).on('unlink', filePath => {
					if(filePath.split(path.sep).pop() == this.configFilename) {
						this.projectConfigs[i] = null;
						//console.log("The config file was removed!");
					} else {
						this.delete(i, filePath);
					}
				}).on('change', (filePath, stats) => {
					if(filePath.split(path.sep).pop() == this.configFilename) {
						this.readConfigFile(i);
					} else if(filePath.indexOf(path.join(this.projectPaths[i],this.projectConfigs[i].local.source)) > -1) {
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
		//console.log("readConfigFile: " + i);
		//console.log("this.projectConfigFile[i]: " + this.projectConfigFile[i]);
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
	},

	parseConfigFile(i, data) {
		try {
			// Parse config file
			this.projectConfigs[i] = JSON.parse(data);

			// Add config file validations and error helper messages

			// Show notification
			this.notification(i,'success','Listening to ' + this.projectConfigs[i].local.source);
			console.log("i: " + i);
			console.log(this.projectConfigs[i]);
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
		// Create new SFTP instance
		var conn = new FTP();
		conn.on('ready', () => {
			console.log('Client :: ready');

			conn.sftp( (err, sftp) => {
				if (err) throw err;

				sftp.readdir(this.projectConfigs[i].remote.target, (err, list) => {
					if (err) throw err;
					console.dir(list);
					conn.end();
				});

				var localSourceFolder = path.join(this.projectPaths[i],this.projectConfigs[i].local.source);
				var relativeTarget = path.relative(localSourceFolder,source);
				var target = path.join(this.projectConfigs[i].remote.target, relativeTarget);
				sftp.fastPut(source, target, (error) => {
					if(error) {
						this.notification(i, 'error', 'There was error uploading ' + relativeTarget + ': ' + error);
					} else {
						this.notification(i, 'success', 'Uploaded ' + relativeTarget);
					}
				});
			});

		}).connect({
			host: this.projectConfigs[i].remote.host,
			port: this.projectConfigs[i].remote.port,
			username: this.projectConfigs[i].remote.user,
			password: this.projectConfigs[i].remote.pass
		});
	},

	delete(i, source) {
		this.notification(i,'info','Deleting file...', {dismissable:true});
		console.log('Delete: ' + source);
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
