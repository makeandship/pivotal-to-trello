'use strict';

var Promise = require('bluebird');

var Trello = require('node-trello');

const API = 'https://api.trello.com'

class TrelloAdapter {
	constructor(key, token, org) {
		this.key = key;
		this.token = token;
		this.org = org;

		this.trello = new Trello(this.key, this.token);
	}

	getBoards() {
		var that = this;
		return new Promise(function(resolve, reject) {
			that.trello.get('/1/organizations/' + that.org + '/boards', function(err, boards) {
				if (err) {
					reject(err);
				}
				else {
					resolve(boards);
				}
			});
		});
	}

	getBoard(name) {
		return this.getBoards()
			.then(function(boards) {
        for (let i=0; i<boards.length; i++) {
          let board = boards[i];
          if (board.name === name) {
            return Promise.resolve(board);
          }
        }

        return Promise.reject('No board with name ' + name + ' exists');
      });
	}

  getLabels(id) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/boards/' + id + '/labels';
      console.log(uri);
      that.trello.get(uri, function(err, labels) {
        if (err) {
          reject(err);
        }
        else {
          resolve(labels);
        }
      });
    });
  }

  createLabel(label) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/labels';
      that.trello.post(uri, label, function(err, savedLabel) {
        if (err) {
          reject(err);
        }
        else {
          resolve(savedLabel);
        }
      });
    });
  }

  getLists(id) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/boards/' + id + '/lists';
      that.trello.get(uri, function(err, lists) {
        if (err) {
          reject(err);
        }
        else {
          resolve(lists);
        }
      });
    });
  }

  createList(id, list) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/boards/' + id + '/lists';
      that.trello.post(uri, list, function(err, savedLabel) {
        if (err) {
          reject(err);
        }
        else {
          resolve(savedLabel);
        }
      });
    });
  }

  getCards(id) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/boards/' + id + '/cards';
      that.trello.get(uri, function(err, cards) {
        if (err) {
          reject(err);
        }
        else {
          resolve(cards);
        }
      });
    });
  }

  createCard(id, card) {
    var that = this;
    return new Promise(function(resolve, reject) {
      var uri = '/1/cards';
      that.trello.post(uri, card, function(err, savedLabel) {
        if (err) {
          reject(err);
        }
        else {
          resolve(savedLabel);
        }
      });
    });
  }

  createChecklist(id, name) {
    var that = this;

    var listName = name || 'Tasks';
    return new Promise(function(resolve, reject) {
      var uri = '/1/checklists';
      var checklist = {
        idCard: id,
        name: name
      };
      that.trello.post(uri, checklist, function(err, savedChecklist) {
        if (err) {
          reject(err);
        }
        else {
          resolve(savedChecklist);
        }
      });
    });
  }
}

module.exports = TrelloAdapter;