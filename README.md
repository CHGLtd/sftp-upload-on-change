# sftp-upload-on-change for Atom

An Atom package that listens for changes (updates and deletes only for now) in your project directory and updates the server correspondingly using SFTP.

## Why?

I have created this package because neither remote-sync nor remote-sync-pro work with SFTP - both fail after 9 successful uploads.

## Installation

1. In Atom, press <kbd>shift</kbd>+<kbd>cmd</kbd>+<kbd>p</kbd> (macOS) and type `install package`
2. Then search for `sftp-upload-on-change` and click on the `install` button.

## Quickstart

1. If sftp-upload-on-change doesn't find a configuration file in your root folder, it will ask you if you'd like to have one created for you.
2. Edit your config file accordingly

### Example Config File
```
{
	"local": {
		"source"		: "/production"
	},
	"remote": {
		"host"			: "ftp.domain.com",
		"port"			: "22",
		"user"			: "user",
		"password"		: "pw",
		"target"		: "/home/user/website.com"
	}
}

```

## Dependencies

Chokidar for watching files.
SSH2 for the SFTP connection.
