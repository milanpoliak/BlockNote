import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addTitleToGroups,
  Files,
  getExampleProjects,
  getProjectFiles,
  groupProjects,
  Project,
} from "./util.js";

/*
 `genDocs` generates the nextjs example blocks for the website docs. 
 Note that these files are not checked in to the repo, so this command should always be run before running / building the site
 */
const dir = path.parse(fileURLToPath(import.meta.url)).dir;

const getLanguageFromFileName = (fileName: string) => fileName.split(".").pop();

/******* templates + generate functions *******/
const templateExampleBlock = (
  project: Project,
  files: Files
) => `import { ExampleBlock } from "@/components/example/ExampleBlock";
import { Tabs } from "nextra/components";

<ExampleBlock name="${project.fullSlug}" path="${
  project.pathFromRoot
}" isProExample={props.isProExample}>
  <Tabs items={${JSON.stringify(
    Object.keys(files).map((fileName) => fileName.slice(1))
  )}}>
    ${Object.entries(files)
      .map(
        ([filename, file]) =>
          `<Tabs.Tab>
            <div className={"max-h-96 overflow-auto rounded-lg overscroll-contain"}>
\`\`\`${getLanguageFromFileName(filename)} 
${file.code}
\`\`\`
            </div>
          </Tabs.Tab>`
      )
      .join("")}
  </Tabs>
</ExampleBlock>`;

const COMPONENT_DIR = path.resolve(
  dir,
  "../../../docs/components/example/generated/"
);

const EXAMPLES_PAGES_DIR = path.resolve(dir, "../../../docs/pages/examples/");

/**
 * Generates the <ExampleBlock> component that has all the source code of the example
 * This block can be used both in the /docs and in the /example page
 */
async function generateCodeForExample(project: Project) {
  const target = path.join(COMPONENT_DIR, "mdx", project.fullSlug + ".mdx");

  const files = getProjectFiles(project);
  const filtered = Object.fromEntries(
    Object.entries(files).filter(([filename, file]) => !file.hidden)
  );

  const code = templateExampleBlock(project, filtered);

  fs.mkdirSync(path.dirname(target), { recursive: true });

  fs.writeFileSync(target, code);
}

const templatePageForExample = (
  project: Project,
  readme: string
) => `import { Example } from "@/components/example";

${readme}

<Example name="${project.fullSlug}" />`;

/**
 * Generate the page for the example in /examples overview
 *
 * Consists of the contents of the readme + the interactive example
 */
async function generatePageForExample(project: Project) {
  const target = path.join(EXAMPLES_PAGES_DIR, project.fullSlug + ".mdx");

  const files = getProjectFiles(project);

  const code = templatePageForExample(project, files["/README.md"]!.code);

  fs.writeFileSync(target, code);
}

/**
 * generates _meta.json file for each example group, so that order is preserved
 */
async function generateMetaForExampleGroup(group: {
  title: string;
  slug: string;
  projects: Project[];
}) {
  if (!fs.existsSync(path.join(EXAMPLES_PAGES_DIR, group.slug))) {
    fs.mkdirSync(path.join(EXAMPLES_PAGES_DIR, group.slug));
  }

  const target = path.join(EXAMPLES_PAGES_DIR, group.slug, "_meta.json");

  const meta = Object.fromEntries(
    group.projects.map((project) => [
      project.projectSlug,
      {
        title: project.config.shortTitle || project.title,
      },
    ])
  );

  const code = JSON.stringify(meta, undefined, 2);

  fs.writeFileSync(target, code);
}

const templateExampleComponents = (
  projects: Project[]
) => `// generated by dev-scripts/examples/genDocs.ts
import dynamic from "next/dynamic";
  
export const examples = {
${projects
  .map((p) => {
    const importPath = `../../../../${p.pathFromRoot}/App`;

    return `  "${p.fullSlug}": {
    // App: () => <div>hello</div>,
    App: dynamic(() => import(${JSON.stringify(importPath)}), {
      ssr: false,
    }),
    ExampleWithCode: dynamic(() => import("./mdx/${p.fullSlug}.mdx"), {
      //ssr: false,
    }),
    pro: ${p.config.pro || false}
  },`;
  })
  .join("\n")}  
};`;

/**
 * Generate the file with all the dynamic imports for examples (exampleComponents.gen.tsx)
 */
async function generateExampleComponents(projects: Project[]) {
  const target = path.join(COMPONENT_DIR, "exampleComponents.gen.tsx");

  const code = templateExampleComponents(projects);

  fs.writeFileSync(target, code);
}

/**
 * generates exampleList.gen.ts file with data about all the examples
 */
async function generateExampleList(projects: Project[]) {
  const target = path.join(COMPONENT_DIR, "exampleList.gen.ts");

  const groups = addTitleToGroups(groupProjects(projects));

  const items = Object.entries(groups).map(([key, group]) => {
    return {
      text: group.title,
      items: group.projects.map((project) => {
        return {
          text: project.title,
          link: `/examples/${project.fullSlug}`,
          author: project.config.author,
        };
      }),
    };
  });

  const code = `// generated by dev-scripts/examples/genDocs.ts
  export const EXAMPLES_LIST = ${JSON.stringify(items, undefined, 2)};`;

  fs.writeFileSync(target, code);
}

// clean old files / dirs
fs.rmSync(COMPONENT_DIR, { recursive: true, force: true });

fs.readdirSync(EXAMPLES_PAGES_DIR, { withFileTypes: true }).forEach((file) => {
  if (file.isDirectory()) {
    fs.rmSync(path.join(EXAMPLES_PAGES_DIR, file.name), {
      recursive: true,
      force: true,
    });
  }
});

// generate new files
const projects = getExampleProjects().filter((p) => p.config?.docs === true);
const groups = addTitleToGroups(groupProjects(projects));

for (const group of Object.values(groups)) {
  await generateMetaForExampleGroup(group);

  for (const project of group.projects) {
    // eslint-disable-next-line no-console
    console.log("generating docs for", project.fullSlug);
    await generateCodeForExample(project);
    await generatePageForExample(project);
  }
}

await generateExampleComponents(projects);
await generateExampleList(projects);
