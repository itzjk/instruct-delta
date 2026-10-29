# Reproduce the demo

From a fresh clone with Node.js 22+, Git, VHS, and its terminal/browser dependencies installed:

```sh
vhs docs/demo.tape
```

The tape creates an isolated example repository in `.demo-repo`, with `base` and `head` tags. Both the root `AGENTS.md` and `packages/api/CLAUDE.md` change. Root coverage contains five entries; API coverage contains two. The instructions and source files in this example are synthetic.

The recording runs the real CLI against those commits. It shows the smaller radius of the API instruction alongside the root instruction's repository-wide coverage. The tape leaves the example repository available for inspection and refuses to overwrite an existing directory. For another recording, use a fresh clone or move `.demo-repo` aside.

To create only the example repository:

```sh
npm run demo
```

Then compare it from inside `.demo-repo`:

```sh
node ../bin/instruct-delta.mjs --base base --head head --json
```
