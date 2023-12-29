#!/usr/bin/env node

const fs = require('fs')
const readline = require('readline')

const originalDescription = 'description-of-project-goes-here'
const originalNamespace = 'adp-demo'
const originalProjectName = 'adp-backend-template-node'
const originalHelmDir = './helm/adp-backend-template-node'
const originalInfraHelmDir = './helm/adp-backend-template-node-infra'

function processInput (args) {
  const [, , projectName, description] = args
  if (args.length === 2) {
    console.error('Please enter a new name and description for the project e.g. ffc-demo-claim-service "Backend for demo workstream".')
    process.exit(1)
  }
  if (args.length !== 4 || !projectName || projectName.split('-').length < 3 || !description) {
    const errMsg = [
      'Please enter a new name and description for the project.',
      'The name must contain two hypens and be of the form "<program>-<worksream>-<repo>" e.g. "ffc-demo-claim-service".',
      'The description must not be empty and be wrapped in quotes e.g. "excellent new description".'
    ]
    console.error(errMsg.join('\n'))
    process.exit(1)
  }
  return { description, projectName }
}

async function confirmRename (projectName, description) {
  const affirmativeAnswer = 'yes'
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve, reject) => {
    rl.question(`Do you want to rename the project to '${projectName}', with a description of '${description}'?\nType '${affirmativeAnswer}' to confirm\n`, (answer) => {
      rl.close()
      resolve(answer === affirmativeAnswer)
    })
  })
}

function getScriptDir () {
  return './scripts'
}

function getHelmDir (projectName) {
  return `./helm/${projectName}`
}

function getInfraHelmDir (projectName) {
  return `./helm/${projectName}-infra`
}

async function getHelmFiles (projectName) {
  const helmDir = getHelmDir(projectName)
  const baseFiles = ['Chart.yaml', 'values.yaml']
  const templateFiles = ['templates/_container.yaml', 'templates/config-map.yaml', 'templates/deployment.yaml']
  const files = [...baseFiles, ...templateFiles]

  return files.map((file) => {
    return `${helmDir}/${file}`
  })
}

async function getInfraHelmFiles (projectName) {
  const helmDir = getInfraHelmDir(projectName)
  const baseFiles = ['Chart.yaml', 'values.yaml']
  const templateFiles = ['templates/namespace-queue.yaml', 'templates/userassignedidentity.yaml', 'templates/flexible-server-db.yaml']
  const files = [...baseFiles, ...templateFiles]

  return files.map((file) => {
    return `${helmDir}/${file}`
  })
}

function getRootFiles () {
  return ['docker-compose.yaml', 'docker-compose.override.yaml', 'docker-compose.debug.yaml', 'docker-compose.test.yaml', 'docker-compose.test.watch.yaml', 'docker-compose.test.debug.yaml', 'package.json', 'package-lock.json']
}

function getCIpipelineFile(){
  return ['./.azuredevops/build.yaml']
}

function getScriptFiles () {
  const scriptDir = getScriptDir()
  const files = ['test']
  return files.map((file) => {
    return `${scriptDir}/${file}`
  })
}

function getNamespace (projectName) {
  const firstIndex = projectName.indexOf('-')
  const secondIndex = projectName.indexOf('-', firstIndex + 1)
  return projectName.substring(0, secondIndex)
}

async function renameDirs (projectName) {
  await fs.promises.rename(originalHelmDir, `./helm/${projectName}`)
  await fs.promises.rename(originalInfraHelmDir, `./helm/${projectName}-infra`)
}

async function updateProjectName (projectName) {
  const rootFiles = getRootFiles()
  const buildYaml = getCIpipelineFile()
  const helmFiles = await getHelmFiles(projectName)
  const infraHelmFiles = await getInfraHelmFiles(projectName)
  const scriptFiles = await getScriptFiles()
  const filesToUpdate = [...rootFiles, ...helmFiles, ...infraHelmFiles, ...scriptFiles, ...buildYaml]
  const namespace = getNamespace(projectName)

  console.log(`Updating projectName from '${originalProjectName}', to '${projectName}'. In...`)
  await Promise.all(filesToUpdate.map(async (file) => {
    console.log(file)
    const content = await fs.promises.readFile(file, 'utf8')
    const projectNameRegex = new RegExp(originalProjectName, 'g')
    const namespaceRegex = new RegExp(originalNamespace, 'g')
    const updatedContent = content.replace(projectNameRegex, projectName).replace(namespaceRegex, namespace)
    return fs.promises.writeFile(file, updatedContent)
  }))
  console.log('Completed projectName update.')
}

async function updateProjectDescription (projectName, description) {
  const helmDir = await getHelmDir(projectName)
  const infraHelmDir = await getInfraHelmDir(projectName)
  const filesToUpdate = ['package.json', `${helmDir}/Chart.yaml`, `${infraHelmDir}/Chart.yaml`]

  console.log(`Updating description from '${originalDescription}', to '${description}'. In...`)
  await Promise.all(filesToUpdate.map(async (file) => {
    console.log(file)
    const content = await fs.promises.readFile(file, 'utf8')
    const updatedContent = content.replace(originalDescription, description)
    return fs.promises.writeFile(file, updatedContent)
  }))
  console.log('Completed description update.')
}

async function rename () {
  const { description, projectName } = processInput(process.argv)
  const rename = await confirmRename(projectName, description)
  if (rename) {
    await renameDirs(projectName)
    await updateProjectName(projectName)
    await updateProjectDescription(projectName, description)
  } else {
    console.log('Project has not been renamed.')
  }
}

rename()
