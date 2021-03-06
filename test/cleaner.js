'use strict'

const test = require('ava')
const Cleaner = require('../lib/cleaner')
const get_clone = require('./fixtures/nodes')

test('should clean nodes', t => {
  let {
    nodes
  } = get_clone.cleaned()

  let a = nodes['/path/to/a.js']

  t.is(a.id, 'a@1.0.0/a.js')
  t.is(a.resolved['./b'], 'a@1.0.0/b.json')
})


test('should throw error if no dependencies found in pkg', t => {
  let {
    cwd,
    pkg,
    nodes
  } = get_clone()

  delete pkg.dependencies

  try {
    new Cleaner({
      cwd,
      pkg
    }).clean(nodes)
  } catch (e) {
    t.is(e.code, 'NOT_INSTALLED')
    t.is(e.dependency, 'b')
    t.is(e.filename, '/path/to/a.js')
    return
  }

  t.fail()
})


test('should not throw error if no dependencies found in pkg, but allowImplicitDependency is true', t => {
  let {
    cwd,
    pkg,
    nodes
  } = get_clone()

  delete pkg.dependencies

  try {
    nodes = new Cleaner({
      cwd,
      pkg,
      allowImplicitDependency: true
    }).clean(nodes)
  } catch (e) {
    t.fail()
  }

  t.is(nodes['/path/to/a.js'].resolved.b, 'b@*')
})


test('should throw if require a module out of package', t => {
  let {
    cwd,
    pkg,
    nodes
  } = get_clone()

  let b = '/path/b.json'

  nodes['/path/to/a.js'].require['../b'] = b
  nodes[b] = {
    id: b
  }

  try {
    new Cleaner({
      cwd,
      pkg
    }).clean(nodes)
  } catch (e) {
    t.is(e.code, 'OUT_OF_PACKAGE')
    t.is(e.dependency, '../b')
    t.is(e.filename, '/path/to/a.js')
    return
  }

  t.fail()
})

