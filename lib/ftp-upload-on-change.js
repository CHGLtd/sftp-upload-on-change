'use babel';

// Imports
import { CompositeDisposable } from 'atom';

// Node modules
const fs = require('fs');
const path = require('path');

export default {

	packageName					:'ftp-upload-on-change',
	configFilename				:null,
	projectPaths				:null,
	projectConfigFile			:null,
	projectConfigFileWatcher	:null,
	projectConfigs				:null,
	projectWatchers				:null,
	projectNotifications		:null,
	active						:null,
	subscriptions				:null,

	activate() {
		// Initialize variables
		this.configFilename 			= '.' + this.packageName + '.json';
		this.projectPaths				= new Array();
		this.projectConfigFile			= new Array();
		this.projectConfigFileWatcher	= new Array();
		this.projectConfigs 			= new Array();
		this.projectWatchers 			= new Array();
		this.projectNotifications 		= new Array();
		this.active 					= true;

		this.projectPaths 				= atom.project.getPaths();
		for (var i = 0; i < this.projectPaths.length; i++) {
			this.projectConfigFile[i]	= path.join(this.projectPaths[i],this.configFilename);
		}

		// Attach watchers to config files
		this.watchConfigFiles();

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that actives this view
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'ftp-upload-on-change:toggle': () => this.toggle(),
			'ftp-upload-on-change:create': () => this.createConfigFile()
		}));
	},

	deactivate() {
		deathis.packageName = null;
		this.configFilename = null;
		this.projectPaths = null;
		this.projectConfigFile = null;
		for (var i = 0; i < this.projectConfigFileWatcher.length; i++) {
			if(this.projectConfigFileWatcher[i]) this.projectConfigFileWatcher[i].close();
		}
		this.projectConfigFileWatcher = null;
		this.projectConfigs = null;
		for (var i = 0; i < this.projectWatchers.length; i++) {
			if(this.projectWatchers[i]) this.projectWatchers[i].close();
		}
		this.projectWatchers = null;
		this.projectNotifications = null;
		this.active = null;
		this.subscriptions.dispose();
	},

	watchConfigFiles() {
		// Watch config files for changes
		for (var i = 0; i < this.projectConfigFile.length; i++) {
			this.watchConfigFile(i);
		}
	},

	watchConfigFile(i) {
		try {
			this.projectConfigFileWatcher[i] = fs.watch(this.projectConfigFile[i], (eventType, filename) => {
				if(eventType == 'change' && filename == this.configFilename) {
					if(this.projectConfigFileWatcher[i]) this.projectConfigFileWatcher[i].close();
					this.parseConfigFile(i);
				}
			});
			this.parseConfigFile(i);
		} catch(error) {
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
	},

	createConfigFile(i) {
		var source = path.join(__dirname, '..' , this.configFilename);
		this.copyFile(source, this.projectConfigFile[i], (error) => {
			if(error) {
				this.notification(i,'warning','There was an error creating your config file. Maybe it\'s already there?',{ dismissable: true });
				return;
			}
			this.notification(i,'success','Edit your new ' + this.configFilename);
			this.watchConfigFile(i);
			this.parseConfigFile(i);
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

	parseConfigFile(i) {
		fs.readFile(this.projectConfigFile[i], 'utf8', (err, data) => {
			if (err) throw err;
			try {
				this.projectConfigs[i] = JSON.parse(data);
				this.listen(i);
			} catch (e) {
				this.notification(i,'error','Your config file has an error:<br />' + e);
			}
		});
	},

	listen(i) {
		try {
			this.projectWatchers[i] = fs.watch(this.projectPaths[i] + this.projectConfigs[i].local.source, { recursive: true }, (eventType, filename) => {
				if(eventType == 'change' && filename) {
					var source = path.join(this.projectPaths[i],filename);
					this.upload(source);
				}
			});
			this.notification(i,'success','Listening to ' + this.projectConfigs[i].local.source);
		} catch(error) {
			this.notification(i,'error', 'Error on ' + this.projectConfigs[i].local.source + ': ' + error);
		}
	},

	startListening() {
		for (var i = 0; i < this.projectConfigFile.length; i++) {
			this.parseConfigFile(i);
		}
	},

	stopListening() {
		for (var i = 0; i < this.projectWatchers.length; i++) {
			if(this.projectWatchers[i]) this.projectWatchers[i].close();
		}
	},

	toggle() {
		console.log("Toggle!");
		this.active = !this.active;

		this.active ? this.startListening() : this.stopListening();

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

	upload(source) {
		atom.notifications.addInfo('Uploading file');

		// Uploading file
		// Try using https://github.com/sergi/jsftp
	}
};
