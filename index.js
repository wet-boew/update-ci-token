var request = require('request');

var ghUser = 'wet-boew-bot',
  ghPass = process.env.WET_BOT_PASS,
  ghAuthOptions = {
    url: 'https://api.github.com/authorizations',
    auth: {
      user: ghUser,
      pass: ghPass
    },
    headers: {
      'User-Agent': 'npm request'
    },
    json: true
  },
  travisOptions = {
    headers: {
      'User-Agent': 'Travis; npm request',
      'Accept': 'application/vnd.travis-ci.2+json'
    },
    json: true
  },
  travisPublicOptions = Object.assign({}, travisOptions, {
    url: 'https://api.travis-ci.org'
  }),
  travisPrivateOptions = Object.assign({}, travisOptions, {
    url: 'https://api.travis-ci.com'
  }),
  travisAuthEndpoint = '/auth/github',
  tokenId = 'GH_TOKEN',
  tokenMessage = 'Token for Pushing from Travis CI',
  repos = [
    {slug: 'wet-boew/wet-boew'},
    {slug: 'wet-boew/theme-base'},
    {slug: 'wet-boew/theme-gc-intranet'},
    {slug: 'wet-boew/theme-gcwu-fegc'},
    {slug: 'wet-boew/GCWeb'},
    {slug: 'wet-boew/wet-boew-styleguide'},
    {slug: 'bci-web/gcweb-cdn', private: true}
  ],
  checkToken = function(tokens) {
    var t, token;

    for (var t = 0; t < tokens.length; t++) {
      token = tokens[t];
      if (token.note === tokenMessage) {
        return deleteToken(token.id, createToken);
      }
    }

    createToken();
  },
  deleteToken = function(tokenId, cb) {
    request(Object.assign({}, ghAuthOptions, {
      method: 'DELETE',
      url: ghAuthOptions.url + '/' + tokenId
    }), function(error, response, body) {
      console.log('Deleted token');
      cb();
    })
  },
  createToken = function() {
    request(Object.assign({}, ghAuthOptions, {
      method: 'POST',
      body: {
        scopes: [
          'repo'
        ],
        note: tokenMessage
      }
    }), function(error, response, token) {
      console.log('Created new token');
      updateCITokens(token.token);
    });
  },
  authenticateTravis = function(options, cb) {
    var ghToken = process.env.GH_TOKEN,
      newOptions = Object.assign({}, options, {
        method: "POST",
        body: {
          github_token: ghToken
        }
      });
      newOptions.url += travisAuthEndpoint;
    request(newOptions, function(error, response, body) {
      if (typeof body === "string") {
        console.error(body);
        process.exit(1);
      }
      options.headers.Authorization = 'token ' + body.access_token;
      cb();
    });
  },

  updateTravisRepoEnvVar = function(token, repo_slug, env_var, options) {
    var getRepoTravisId = function(cb) {
      var newOptions = Object.assign({}, options);
      newOptions.url += '/repos/' + repo_slug
      request(newOptions, function(error, response, body) {
        cb(body.repo.id);
      });
    },
    getTravisEnvVarId = function(repoId, cb) {
      var newOptions = Object.assign({}, options);
      newOptions.url += '/settings/env_vars?repository_id=' + repoId;
      request(newOptions, function(error, response, body) {
        var e, env_var;
        for (e = 0; e < body.env_vars.length; e++) {
          env_var = body.env_vars[e];
          if (env_var.name === "GH_TOKEN") {
            cb(env_var.id);
          }
        }
      });
    },
    updateTravisEnvVar = function(repoId, env_var_id, cb) {
      var newOptions = Object.assign({}, options, {
        method: "PATCH",
        body: {
          env_var: {
            value: token
          }
        }
      });
      newOptions.url += '/settings/env_vars/' + env_var_id + '?repository_id=' + repoId;
      request(newOptions, function(error, response, body) {
        cb();
      });
    };

    getRepoTravisId(function(repoId){
      getTravisEnvVarId(repoId, function(env_var_id) {
        updateTravisEnvVar(repoId, env_var_id, function() {
          console.log("Updated token for repo " + repo_slug);
        });
      });
    });
  },
  updateCITokens = function(token) {
    authenticateTravis(travisPublicOptions, function() {
      console.log('Authenticated with Travis CI');
      authenticateTravis(travisPrivateOptions, function() {
        console.log('Authenticated with Travis CI Pro');
        for (var r = 0; r < repos.length; r++) {
          updateTravisRepoEnvVar(token, repos[r].slug, tokenId, repos[r].private ? travisPrivateOptions : travisPublicOptions);
        }
      });
    });
  };

request(ghAuthOptions, function(error, response, body) {
  checkToken(body)
});
