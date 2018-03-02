'use babel';

import { CompositeDisposable } from 'atom';

const fs = require('fs');
const path = require('path');

const configFilename = '.ftp-upload-on-change.json';
const projectRoot = atom.project.getPaths()[0];

export default {

	subscriptions: null,
	configFile:path.join(atom.project.getPaths()[0],configFilename),
	watchConfig:null,
	config:null,
	active:true,
	watch:null,

	activate() {
		this.configExists();

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that toggles this view
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'ftp-upload-on-change:toggle': () => this.toggle(),
			'ftp-upload-on-change:create': () => this.createConfigFile()
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
		this.watchConfig.close();
		this.watch.close();
	},

	configExists() {
		// Check if the config file exists
		fs.exists(this.configFile, (exists) => {
			if(exists) {
				this.watchConfigFile();
				this.parseConfigFile();
			} else {
				notification = atom.notifications.addWarning(
					'ftp-upload-on-change: No config file present.', {
						dismissable: true,
						buttons: [
							{
								text: 'Create config file',
								onDidClick: () => {
									this.createConfigFile();
									notification.dismiss();
								}
							}
						]
					}
				)
			}
		});
	},

	watchConfigFile() {
		// Watch config file for changes
		this.watchConfig = fs.watch(this.configFile, (eventType, filename) => {
			if(eventType == 'change' && filename == '.ftp-upload-on-change.json') {
				if(this.watch) this.watch.close();
				this.parseConfigFile();
			}
		});
	},

	parseConfigFile() {
		fs.readFile(this.configFile, 'utf8', (err, data) => {
			if (err) throw err;
			this.config = JSON.parse(data);
			this.listen();
		});
	},

	listen() {
		// Make sure source exists
		fs.exists(projectRoot + this.config.local.source, (exists) => {
			if(!exists) {
				atom.notifications.addError('ftp-upload-on-change: ' + this.config.local.source + ' doesn\'t exist! Edit your config file.');
			} else {
				this.watch = fs.watch(projectRoot + this.config.local.source, { recursive: true }, (eventType, filename) => {
					if(eventType == 'change' && filename) {
						// Upload file
						var source = path.join(projectRoot,filename);
						this.upload(source);
					}
				});
				atom.notifications.addSuccess('ftp-upload-on-change: Listening to ' + this.config.local.source);
			}
		});
	},

	stopListen() {
		if(this.watch) this.watch.close();
		atom.notifications.addWarning('ftp-upload-on-change: Stopped listening.');
	},

	upload(source) {
		var filePath = path.relative(projectRoot, source);
		filePath = path.join(this.config.local.source, filePath);
		atom.notifications.addInfo('ftp-upload-on-change: Uploading <b>' + filePath + '</b>', {dismissable:true});
	},

	toggle() {
		if(!this.configFile) {
			atom.notifications.addWarning('ftp-upload-on-change: There is no config file. Select Packages -> ftp-upload-on-change -> Create config file to create one.', {dismissable:true});
		}
		this.active = !this.active;
		this.active ? this.configExists() : this.stopListen();
	},

	createConfigFile() {
		// Check if the config file exists
		fs.exists(this.configFile, (exists) => {
			if(!exists) {
				var source = path.join(__dirname, '..' ,configFilename);
				var target = path.join(projectRoot, configFilename);
				this.copyFile(source, target, (error) => {
					if(error) throw error;
					atom.notifications.addSuccess('A new .ftp-upload-on-change.json config file was created for you! Make sure you edit it.');
				});
			} else {
				atom.notifications.addWarning('An .ftp-upload-on-change.json config file already exists in your project\'s root folder!');
			}
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
	}
};
