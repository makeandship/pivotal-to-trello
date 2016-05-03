'use strict';

var request = require('hyperquest');
var FormData = require('form-data');
var _ = require('lodash');
var Promise = require('bluebird');
var TrelloAdapter = require('./trello-adapter');
var PivotalAdapter = require('./pivotal-adapter');

const LISTS = [
  { name: 'Icebox' },
  { name: 'Backlog' },
  { name: 'Current' },
  { name: 'Delivered' },
  { name: 'Done' }
];

const LABELS = [
  { name: 'Chore', color: 'orange' },
  { name: 'Bug', color: 'red' },
  { name: 'Feature', color: '' },
  { name: 'Release', color: 'blue' }  
];

class Importer {
  constructor(config) {
    this.config = config;
    
    this.trello = new TrelloAdapter(this.config.trello.key, this.config.trello.token, this.config.trello.organisation);
    this.pivotal = new PivotalAdapter(this.config.pivotal.token);

    this.labels = {};
    this.lists = {};
    this.board = null;
    this.project = null;
    this.cards = {};
    this.stories = {};
  }

  getList(status) {
    var listId = null; 

    switch(status) {
      case 'accepted': 
        listId = this.lists['Done'].id;
        break;
      case 'unstarted': 
        listId = this.lists['Current'].id;
        break;
      case 'started': 
        listId = this.lists['Current'].id;
        break;
      case 'delivered': 
        listId = this.lists['Delivered'].id;
        break;
      case 'finished': 
        listId = this.lists['Delivered'].id;
        break;
      case 'unscheduled': 
        listId = this.lists['Icebox'].id;
        break;
      default: 
        console.log('Missing status: ' + status);
    }

    return listId;
  }

  getLabel(type) {
    var labelId = null; 
    
    switch(type) {
      case 'chore': 
        labelId = this.labels['Chore'].id;
        break;
      case 'bug': 
        labelId = this.labels['Bug'].id;
        break;
      case 'feature': 
        labelId = this.labels['Feature'].id;
        break;
      case 'release': 
        labelId = this.labels['Release'].id;
        break;
      default: 
        console.log('Missing type: ' + type);
    }

    return labelId;
  }

  getTitle(name, points) {
    var title = name;
    if (points) {
      if (points != "-1") {
        title = '[' + points + '] ' + title;
      }
    }

    return title;
  }

  import() {
    var that = this;

    // verify load the pivotal project

    // verify and load trello board
    var boardName = this.config.migration[0].trello;
    var projectName = this.config.migration[0].pivotal;

    that.trello
      .getBoard(boardName)
      .then(function(loadedBoard) {
        console.log('Load trello labels ...');
        that.board = loadedBoard;
        // gather list of labels
        return that.trello
          .getLabels(that.board.id);
      })
      .then(function(loadedLabels) {
        console.log('Identify missing labels ...');
        // identify missing labels
        var required = _.filter(LABELS, function(requiredLabel) {
          var found = _.find(loadedLabels, function(matchLabel) {
            return requiredLabel.name === matchLabel.name;
          });
          if (found) {
            that.labels[found.name] = found;
          }

          return !found;
        });

        return required;
      })
      .then(function(requiredLabels) {
        console.log('Create missing labels ...');
        // create missing labels
        return Promise.reduce(
          requiredLabels,
          function(completed, label, index, len) {
            label.idBoard = that.board.id;
            return that.trello
              .createLabel(label)
              .then(function(savedLabel) {
                completed.push(savedLabel);
                return Promise.resolve(completed);
              });
          },
          []);
      })
      .then(function(savedLabels) {
        console.log('Load trello lists ...');
        // gather list of lists
        return that.trello
          .getLists(that.board.id);
      })
      .then(function(loadedLists) {
        console.log('Identify missing lists ...');
        // identify missing lists
        var required = _.filter(LISTS, function(requiredList) {
          var found = _.find(loadedLists, function(matchList) {
            return requiredList.name === matchList.name;
          });
          if (found) {
            that.lists[found.name] = found;
          }

          return !found;
        });

        return required;
      })
      .then(function(requiredLists) {
        console.log('Create missing trello lists ...');
        // create missing lists
        return Promise.reduce(
          requiredLists,
          function(completed, list, index, len) {
            list.pos = 'bottom';
            return that.trello
              .createList(that.board.id, list)
              .then(function(savedList) {
                completed.push(savedList);
                return Promise.resolve(completed);
              });
          },
          []);
      })
      .then(function(savedLists) {
        console.log('Load pivotal project ...');
        for (let i=0; i<savedLists.length; i++) {
          let savedList = savedLists[i];
          that.lists[savedList.name] = savedList;
        }

        return that.pivotal.getProject(projectName);
      })
      .then(function(loadedProject) {
        console.log('Load pivotal stories ...');
        that.project = loadedProject;

        return that.pivotal.getStories(that.project.id);
      })
      .then(function(loadedStories) {
        console.log('Load trello cards ...');

        // assign an order to stories
        var positionedStories = [];
        for (var i=0; i<loadedStories.length; i++) {
          var loadedStory = loadedStories[i];
          var clone = JSON.parse(JSON.stringify(loadedStory));
          clone.pos = i;
          positionedStories.push(clone);
        }

        // group by id
        for (var i=0; i<loadedStories.length; i++) {
          var loadedStory = loadedStories[i];
          that.stories[loadedStory.id] = loadedStory;
        }        

        return that.trello.getCards(that.board.id)
          .then(function(loadedCards) {
            for (let i=0; i<loadedCards.length; i++) {
              var loadedCard = loadedCards[i];
              that.cards[loadedCard.name] = loadedCard;
            }

            return Promise.resolve(that.cards);
          });
      })
      .then(function(loadedCards) {
        console.log('Load pivotal comments ...');
        
        /*
        var props = {};
        for (let id in that.stories) {
          let story = that.stories[id];
          var promise = that.pivotal
              .getComments(that.project.id, story.id);
          props[id] = promise;
        }

        // get comments 
        return Promise.props(props)
          .then(function(commentsById) {
            for (let id in commentsById) {
              let comments = commentsById[id];
              if (comments) {
                that.stories[id].comments = comments;
              }
            }

            Promise.resolve(that.stories);
          });
        */
        return Promise.reduce(
          _.values(that.stories),
          function(completed, story, index, len) {
            return that.pivotal
              .getComments(that.project.id, story.id)
              .then(function(comments) {
                console.log('Story ' + story.id + ' has ' + comments.length + ' comemnts');
                that.stories[story.id].comments = comments;
                
                Promise.resolve(that.stories[story.id]);
              });
          },
          []);
      })
      .then(function(storiesWithComments) {
        console.log('Load pivotal tasks ...');
        
        var props = {};
        for (let id in that.stories) {
          let story = that.stories[id];
          var promise = that.pivotal
              .getTasks(that.project.id, story.id);
          props[id] = promise;
        }

        // get comments 
        return Promise.props(props)
          .then(function(tasksById) {
            for (let id in tasksById) {
              let tasks = tasksById[id];
              if (tasks) {
                that.stories[id].tasks = tasks;
              }
            }

            Promise.resolve(that.stories);
          });
      })
      .then(function() {
        console.log('Create trello cards ...');

        // debug
        var fs = require('fs');
        var jsonFilename = 'stories.json';
        fs.writeFileSync(jsonFilename, JSON.stringify(that.stories, null, 2));

        var storiesArray = _.values(that.stories);

        // create missing lists
        return Promise.reduce(
          storiesArray,
          function(completed, story, index, len) {
            var name = story.name;
            var type = story.storyType; // assign a label
            var status = story.currentState; // status
            var due = story.deadline;
            var estimate = story.estimate;
            var title = that.getTitle(name, estimate);
            var description = story.description;

            // migrated previously
            var card = that.cards[title];
            if (card) {
              // check if an update is needed
              if (card.description !== description || 
                card.status !== status ||
                card.due !== due) {
                // TODO update the card
                return Promise.resolve(that.cards[title]);
              }
              else {
                return Promise.resolve(that.cards[title]);
              }
            }
            else {
              var card = {};
              card.name = title;
              card.pos = index;
              card.idList = that.getList(status);
              card.idLabels = that.getLabel(type);
              card.due = due;
              card.description = description;
              card.idBoard = that.board.id;

              return that.trello
                .createCard(that.board.id, card)
                .then(function(savedCard) {
                  that.cards[savedCard.name] = savedCard;

                  return Promise.resolve(savedCard);
                });
            }
          },
          []);
      })
      .then(function() {
        console.log('Create trello checklists ...');

        var storiesArray = _.values(that.stories);

        // create missing checklists
        return Promise.reduce(
          storiesArray,
          function(completed, story, index, len) {
            var name = story.name;
            var estimate = story.estimate;
            var title = that.getTitle(name, estimate);
            var tasks = story.tasks;

            // card under update
            var card = that.cards[title];

            if (card && tasks && tasks.length > 0) {
              // make the checklist
              that.trello
                .createChecklist(card.id, 'Tasks')
                .then(function(savedChecklist) {
                  card.checklist = savedChecklist;

                  return Promise.reduce(
                    tasks,
                    function(completed, task, index, len) {
                      var item = {};
                      return that.trello
                        .createTask(savedChecklist, item);
                    },
                    []);
                });
            }
            else {
              Promise.resolve(card);
            }
        // add tasks
        
        // set task status

        // add comments

        // add attachements
      })
      .catch(function(err) {
        console.log(err);
      });
  }
}

module.exports = Importer;