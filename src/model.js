// AppSettings
// -----------------
//
// Persistence for application settings

var AppSettings = function(settings) {
  var dbSettings = {
    host: "127.0.0.1",
    port: 6379,
    scope: "substance-app-settings"
  };

  // override the default values if given
  dbSettings = _.extend(dbSettings, settings);

  this.db = redis.RedisAccess.Create(0);
  this.db.setHost(dbSettings.host);
  this.db.setPort(dbSettings.port);
  this.db.connect();
  this.db.setScope(dbSettings.scope);

  var hash = this.db.asHash("data");

  this.set = function(key, value) {
    hash.set(key, value);
  };

  this.toJSON = function() {
    var res = {};
    _.each(hash.getKeys(), function(key) {
      res[key] = this.get(key);
    }, this);
    return res;
  };

  this.get = function(key) {
    return hash.getJSON(key);
  };
};

var appSettings = new AppSettings();


// Update doc (docstore.setRef)
// -----------------

function updateRef(doc, ref, sha, cb) {
  store.setRef(doc.id, ref, sha);
  updateMeta(doc, cb);
};


function updateMeta(doc, cb) {
  _.extend(doc.meta, doc.content.properties);
  doc.meta.updated_at = new Date();
  store.updateMeta(doc.id, doc.meta, cb);
}

// Some userful helpers
// -----------------


function authenticated() {
  return !!token();
}

function token() {
  return appSettings.get('api-token');
}

function user() {
  return appSettings.get('user');
}

function synced(docId) {
  return session.localStore.getRef(docId, 'master') === session.localStore.getRef(docId, 'master-remote');
}

function published(doc) {
  return !!doc.meta.published_commit;
}


// Initialization
// -----------------

var client,
    localStore,
    remoteStore,
    session;

function initSession() {
  var username = user() || "anonymous";

  client = new Substance.Client({
    "hub_api": Substance.settings.hub_api,
    "client_id": Substance.settings.client_id,
    "client_secret": Substance.settings.client_secret,
    "token": token() // auto-authenticate
  });


  localStore = new Substance.RedisStore({
    scope: username
  });


  // Assumes client instance is authenticated
  remoteStore = new Substance.RemoteStore({
    client: client
  });

  session = new Substance.Session({
    client: client,
    remoteStore: remoteStore,
    localStore: localStore
  });
}


// TODO: Find a better place

function createDump() {
  // TODO: Iterate over all exisiting scopes
  var scopes = ["michael", "oliver"];
  var dump = {};

  _.each(scopes, function(scope) {
    var store = new Substance.RedisStore({scope: scope});
    dump[scope] = store.dump();
  });
  return dump;
}

// This is redundant to hub/lib/documents.js
function seed(seeds, cb) {
  console.log('Seeding the docstore...');

  new Substance.RedisStore({
        scope: "test"
      }).clear();

  if (seeds) {
    _.each(seeds, function(seed, scope) {
      new Substance.RedisStore({
        scope: scope
      }).seed(seed);
    });    
  }

  if (cb) cb(null);
  return true;
}