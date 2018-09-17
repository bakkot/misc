var reducer;
window.onload = () => {

  if (location.hash !== '') {
    try {
      var oldState = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash.substring(1)));
      if (typeof oldState.lm.value === 'string' && typeof oldState.mm.value === 'string') {
        reducerDefault = oldState.lm.value;
        programDefault = oldState.mm.value;
      }
    } catch (e) {
      resultDefault = 'Error reading URL: ' + e.message;
    }
  }


  var keyMap = Object.assign({}, CodeMirror.keyMap.default);
  // keyMap['Cmd-Left'] = false;
  // keyMap['Cmd-Right'] = false;
  var lm = CodeMirror(l, { value: reducerDefault, mode: 'javascript', lineNumbers: true, keyMap, inputStyle: 'contenteditable' });
  var mm = CodeMirror(m, { value: programDefault, mode: 'javascript', lineNumbers: true, keyMap, inputStyle: 'contenteditable' });
  var rm = CodeMirror(r, { value: resultDefault, mode: 'json', lineNumbers: true, keyMap, inputStyle: 'contenteditable', readOnly: true, lineWrapping: true });

  var dSaveState = debounce(saveState, 50);
  lm.on('changes', dSaveState);
  mm.on('changes', dSaveState);

  // ugh. seriously?
  var shiftReducer;
  fetch('./shift-reducer.js')
    .then(x => x.text())
    .then(x => shiftReducer = x);

  evaluate.onclick = () => {
    var reducerSource;
    try {
      reducerSource = prepareReducer(lm.doc.getValue());
    } catch (e) {
      rm.setValue('Error preparing reducer: ' + e.message);
      return;
    }

    var tree;
    try {
      tree = parser.parseModule(mm.doc.getValue());
    } catch (e) {
      rm.setValue('Error reading program: ' + e.message);
      return;
    }


    var realm = Realm.makeRootRealm();
    var prelude = `
      this.window = this;
      ${shiftReducer};
      Object.assign(window, reducer);
    `;

    realm.evaluate(prelude);
    try {
      realm.evaluate(reducerSource);
    } catch (e) {
      rm.setValue('Error evaluating reducer: ' + e.message);
      return;
    }
    realm.evaluate('tree => window.__tree = JSON.parse(tree)')(JSON.stringify(tree));

    try {
      var result;
      result = realm.evaluate('reduce(__reducer, __tree)');
      rm.setValue(JSON.stringify(result, null, '  '));
    } catch (e) {
      rm.setValue('Error evaluating reducer: ' + e.message);
      return;
    }
  };


  function saveState() {
    var stateObj = {
      lm: {
        value: lm.doc.getValue(),
      },
      mm: {
        value: mm.doc.getValue(),
      },
    };

    var stateString = LZString.compressToEncodedURIComponent(JSON.stringify(stateObj));
    history.replaceState(null, null, '#' + stateString);
  }
};


function prepareReducer(src) {
  var tree = parser.parseModule(src);
  var anyImport = tree.items.find(t => t.type.startsWith('Import'));
  if (anyImport != null) {
    throw new TypeError('imports are forbidden');
  }
  var exports = tree.items.filter(t => t.type.startsWith('Export'));
  if (exports.length !== 1 || exports[0].type !== 'ExportDefault') {
    throw new TypeError('You must have an `export default` and no other exports');
  }

  // replace `export default foo` with `window.__reducer = foo`
  var exportIndex = tree.items.findIndex(i => i.type === 'ExportDefault');
  tree.items[exportIndex] = {
    type: 'ExpressionStatement',
    expression: {
      type: 'AssignmentExpression',
      binding: {
        type: 'StaticMemberAssignmentTarget',
        object: {
          type: 'IdentifierExpression',
          name: 'window',
        },
        property: '__reducer',
      },
      expression: exports[0].body,
    },
  };
  return codegen.default(tree);
}

function debounce(f, delay) {
  var timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(f, delay);
  };
}




var reducerDefault = `let EMPTY;
class Collector {
  constructor(x) { this.value = x; }
  static empty() { return EMPTY; }
  concat(a) { return new Collector(this.value.concat(a.value)); }
  extract() { return this.value; }
}
EMPTY = new Collector([]);

class IdentifierCollector extends MonoidalReducer {
  constructor() {
    super(Collector);
  }
  
  reduceModule(node, state) {
    return super.reduceModule(node, state).extract();
  }

  reduceIdentifierExpression(node, state) {
    return new Collector([node.name]);
  }
}

export default new IdentifierCollector();
`;

var programDefault = `a + b;`;

var resultDefault = ``;
