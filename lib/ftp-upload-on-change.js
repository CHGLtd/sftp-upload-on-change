'use babel';

import FtpUploadOnChangeView from './ftp-upload-on-change-view';
import { CompositeDisposable } from 'atom';

export default {

  ftpUploadOnChangeView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.ftpUploadOnChangeView = new FtpUploadOnChangeView(state.ftpUploadOnChangeViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ftpUploadOnChangeView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-upload-on-change:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.ftpUploadOnChangeView.destroy();
  },

  serialize() {
    return {
      ftpUploadOnChangeViewState: this.ftpUploadOnChangeView.serialize()
    };
  },

  toggle() {
    console.log('FtpUploadOnChange was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
