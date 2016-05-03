'use strict';

var PivotalTracker = require('pivotaltracker');
//var PivotalTracker = require("pivotal");
var _ = require('lodash');

class PivotalAdapter {
	constructor(token) {
		this.token = token;

		this.pivotal = new PivotalTracker.Client(this.token);
    //this.pivotal = PivotalTracker;
    //this.pivotal.useToken(this.token);
	}

	getProjects() {
		var that = this;
		return new Promise(function(resolve, reject) {
			that.pivotal.projects.all(function(err, projects) {
      //that.pivotal.getProjects(function(err, projects) {
				if (err) {
					reject(err);
				}
				else {
          resolve(projects);
          //resolve(projects.project);
				}
			});
		});
	}

	getProject(name) {
    var that = this;
		return that.getProjects()
			.then(function(projects) {
        for (let i=0; i<projects.length; i++) {
          let project = projects[i];
          if (project.name === name) {
            return Promise.resolve(project);
          }
        }

        return Promise.reject('No project with name ' + name + ' exists');
      });
	}

  getStories(id) {
    var that = this;
    return new Promise(function(resolve, reject) {
      that.pivotal.project(id).stories.all({ limit:3000 }, function(err, stories) {
      //that.pivotal.getStories(id, {}, function(err, stories) {
        if (err) {
          reject(err);
        }
        else {
          resolve(stories);
          //resolve(stories.story);
        }
      });
    });
  }

  getComments(id, storyId) {
    var that = this;
    return new Promise(function(resolve, reject) {
      that.pivotal.project(id).story(storyId).comments.all(function(err, comments) {
        if (err) {
          reject(err);
        }
        else {
          if (comments) {
            console.log(comments.length + ' comments found for ' + storyId);
          }
          resolve(comments);
          //resolve(stories.story);
        }
      });
    });
  }

  getTasks(id, storyId) {
    var that = this;
    return new Promise(function(resolve, reject) {
      that.pivotal.project(id).story(storyId).tasks.all(function(err, tasks) {
        if (err) {
          reject(err);
        }
        else {
          if (tasks && tasks.length) {
            console.log(tasks.length + ' tasks found for ' + storyId);
          }
          resolve(tasks);
        }
      });
    });
  }
}  

module.exports = PivotalAdapter;