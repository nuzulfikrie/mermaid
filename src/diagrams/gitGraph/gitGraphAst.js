var crypto = require("crypto");
var Logger = require('../../logger');
var _ = require("lodash");

var log = new Logger.Log();
//var log = new Logger.Log(1);


var commits = {};
var head  = null;
var branches = { "master" : head };
var curBranch = "master";
var direction = "LR";
var seq = 0;

function getId() {
    return crypto.randomBytes(20).toString('hex').substring(0, 7);
}


function isfastforwardable(currentCommit, otherCommit) {
    log.debug("Entering isfastforwardable:", currentCommit.id, otherCommit.id);
    while (currentCommit.seq <= otherCommit.seq && currentCommit != otherCommit) {
        // only if other branch has more commits
        if (otherCommit.parent == null) break;
        if (Array.isArray(otherCommit.parent)){
            log.debug("In merge commit:", otherCommit.parent);
            return isfastforwardable(currentCommit, commits[otherCommit.parent[0]]) ||
                    isfastforwardable(currentCommit, commits[otherCommit.parent[1]])
        } else {
            otherCommit = commits[otherCommit.parent];
        }
    }
    log.debug(currentCommit.id, otherCommit.id);
    return currentCommit.id == otherCommit.id;
}

function isReachableFrom(currentCommit, otherCommit) {
    var currentSeq = currentCommit.seq;
    var otherSeq = otherCommit.seq;
    if (currentSeq > otherSeq) return isfastforwardable(otherCommit, currentCommit);
    return false;
}

exports.setDirection = function(dir) {
    direction = dir;
}

exports.commit = function(msg) {
    var commit = { id: getId(),
        message: msg,
        seq: seq++,
        parent:  head == null ? null : head.id};
    head = commit;
    commits[commit.id] = commit;
    branches[curBranch] = commit.id;
    log.debug("in pushCommit");
}

exports.branch = function(name) {
    branches[name] = head != null ? head.id: null;
    log.debug("in createBranch");
}

exports.merge = function(otherBranch) {
    var currentCommit = commits[branches[curBranch]];
    var otherCommit = commits[branches[otherBranch]];
    if (isReachableFrom(currentCommit, otherCommit)) {
        log.debug("Already merged");
        return;
    }
    if (isfastforwardable(currentCommit, otherCommit)){
        branches[curBranch] = branches[otherBranch];
        head = commits[branches[curBranch]];
    } else {
        // create merge commit
        var commit = {
            id: getId(),
            message: 'merged branch ' + otherBranch + ' into ' + curBranch,
            seq: seq++,
            parent:  [head == null ? null : head.id, branches[otherBranch]]
        };
        head = commit;
        commits[commit.id] = commit;
        branches[curBranch] = commit.id;
    }
    log.debug(branches);
    log.debug("in mergeBranch");
}

exports.checkout = function(branch) {
    log.debug("in checkout");
    curBranch = branch;
    var id = branches[curBranch];
    head = commits[id];
}

exports.reset = function(ref) {
    log.debug("in reset");
    var commit = ref == 'HEAD' ? head : commits[branches[ref]];
    head = commit;
    branches[curBranch] = commit.id;
}
function upsert(arr, key, newval) {
    var match = _.find(arr, key);
    if(match){
        var index = _.indexOf(arr, _.find(arr, key));
        arr.splice(index, 1, newval);
    } else {
        arr.push(newval);
    }
    //console.log(arr);
};
function prettyPrintCommitHistory(commitArr) {
    var commit = _.maxBy(commitArr, 'seq');
    var line = "";
    _.each(commitArr, function(c, idx) {
        if (c == commit) {
            line += "\t*"
        } else {
            line +="\t|"
        }
    });
    var label = [line, commit.id, commit.seq];
    _.each(branches, function(v,k){
        if (v == commit.id) label.push(k);
    });
    console.log.apply(console, label);
    if (Array.isArray(commit.parent)) {
        //console.log("here", commit.parent);
        var newCommit = commits[commit.parent[0]];
        upsert(commitArr, commit, newCommit);
        commitArr.push(commits[commit.parent[1]]);
        //console.log("shoudl have 2", commitArr);
    } else if(commit.parent == null){
        return;
    } else {
        var newCommit = commits[commit.parent];
        upsert(commitArr, commit, newCommit);
    }
    commitArr = _.uniqBy(commitArr, 'id');
    prettyPrintCommitHistory(commitArr);

}
exports.prettyPrint = function() {
    var commitArr = Object.keys(commits).map(function (key) {
        return commits[key];
    });
    var sortedCommits = _.orderBy(commitArr, ['seq'], ['desc']);
    console.log(sortedCommits);
    var node = sortedCommits[0];
    prettyPrintCommitHistory([node]);
}

exports.clear = function () {
    commits = {};
    head  = null;
    branches = { "master" : head };
    curBranch = "master";
    seq =0;
}

exports.getBranches = function() { return branches; }
exports.getCommits = function() { return commits; }
exports.getCurrentBranch = function() { return curBranch; }
exports.getDirection = function() { return direction; }
exports.getHead = function() { return head; }
