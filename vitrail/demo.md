
<script>
      import { createDefaultCodeMirror } from "./codemirror6.ts";
      import { config } from "../core/config.js";
      import { xstate, watch } from "./demo.ts";
      
      config.baseURL = "https://lively-kernel.org/lively4/sandblocks-text/";
      
      // document.getElementById("vitrail-editor")?.remove()
      
      
      let editor = <div id="vitrail-editor"></div>

      // document.body.appendChild(editor)

      lively.sleep(0).then(() => {
      createDefaultCodeMirror(
        `
import { createMachine, createActor } from 'xstate';

const textMachine = createMachine({
  context: {
    committedValue: '',
    value: '',
  },
  initial: 'reading',
  states: {
    reading: {
      on: {
        'text.edit': { target: 'editing' },
      },
    },
    editing: {
      on: {
        'text.change': {
          actions: assign({
            value: ({ event }) => event.value,
          }),
        },
        'text.commit': {
          actions: assign({
            committedValue: ({ context }) => context.value,
          }),
          target: 'reading',
        },
        'text.cancel': {
          actions: assign({
            value: ({ context }) => context.committedValue,
          }),
          target: 'reading',
        },
      },
    },
  },
});

const textActor = createActor(textMachine).start();

textActor.subscribe((state) => {
  console.log(state.context.value);
});

textActor.send(sbWatch({ type: 'text.edit' }, '123'));
// logs ''
textActor.send({ type: 'text.change', value: 'Hello' });
// logs 'Hello'
textActor.send({ type: 'text.commit' });
// logs 'Hello'
textActor.send({ type: 'text.edit' });
// logs 'Hello'
textActor.send({ type: 'text.change', value: 'Hello world' });
// logs 'Hello world'
textActor.send({ type: 'text.cancel' });
// logs 'Hello'
      `,
        editor,
        [xstate, watch],
      );      
  })
  editor
</script>