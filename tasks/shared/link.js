var utils = require('shipit-utils');
var path = require('path2/posix');
var chalk = require('chalk');
var Promise = require('bluebird');
var init = require('../../lib/init');
var _ = require('lodash');

/**
 * Create shared symlinks.
 *
 * File test operators:
 * -e file exists
 * -h file is a symbolic link
 */

module.exports = function(gruntOrShipit) {
  var link = function link(item) {
    var shipit = utils.getShipit(gruntOrShipit);

    return init(shipit).then(function(shipit) {
      var source = path.join(shipit.config.shared.symlinkPath, item.path);
      var target = path.join(shipit.releasesPath, shipit.releaseDirname, item.path);
      var check = function() {
        return shipit.remote(`if [ -e ${target} -a ! -h ${target} ]; then echo false; fi`).then(function(response) {
          response.forEach(function(elem) {
            if (elem.stdout.trim() === 'false') {
              throw new Error(`Cannot create shared symlink, file exists at "${target}". See https://github.com/timkelty/shipit-shared/#sharedoverwrite for more information.`);
            }
          });
        })
      };

      return Promise.resolve(item.overwrite ? item.overwrite : check())
      .then(function() {
        // If symlink target is not already a symlink, remove it, then create symlink.
        return shipit.remote(`if ( ! [ -h ${target} ] ); then rm -rf ${target}; ln -s ${source} ${target}; fi`);
      })
      .catch(function(e) {
        console.log(chalk.bold.red('\nError: ' + e.message));
        process.exit();
      });
    });
  }

  var linkDirs = function linkDirs() {
    var shipit = utils.getShipit(gruntOrShipit);

    return init(shipit).then(function(shipit) {
      if (!shipit.config.shared.dirs.length) {
        return Promise.resolve();
      }

      var promises = shipit.config.shared.dirs.map(function(item) {
        return link(item);
      });

      return new Promise.all(promises)
      .then(function() {
        shipit.log(chalk.green('Shared directories symlinked on remote.'));
        shipit.emit('sharedDirsLinked');
      });
    });
  }

  var linkFiles = function linkFiles() {
    var shipit = utils.getShipit(gruntOrShipit);

    return init(shipit).then(function(shipit) {
      if (!shipit.config.shared.files.length) {
        return Promise.resolve();
      }

      var promises = shipit.config.shared.files.map(function(item) {
        return link(item);
      });

      return new Promise.all(promises)
      .then(function() {
        shipit.log(chalk.green('Shared files symlinked on remote.'));
        shipit.emit('sharedFilesLinked');
      });
    });
  }

  utils.registerTask(gruntOrShipit, 'shared:link:dirs', linkDirs);
  utils.registerTask(gruntOrShipit, 'shared:link:files', linkFiles);
  utils.registerTask(gruntOrShipit, 'shared:link', [
    'shared:link:dirs',
    'shared:link:files'
  ]);
};
