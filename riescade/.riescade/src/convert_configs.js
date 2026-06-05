const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const configsDir = path.resolve(__dirname, '../configs');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  ignoreDeclaration: true,
  processEntities: {
    maxTotalExpansions: 99999,
    maxExpandedLength: 1000000
  }
});

// Helper to check if file exists
function exists(file) {
  return fs.existsSync(path.join(configsDir, file));
}

// Helper to read and parse XML
function parseXmlFile(file) {
  const filePath = path.join(configsDir, file);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return parser.parse(content);
}

// Helper to write JSON
function writeJsonFile(file, data) {
  const filePath = path.join(configsDir, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Converted ${file}`);
}

console.log('Starting XML -> JSON migration...');

// 1. Convert settings
if (exists('es_settings.cfg')) {
  try {
    const xmlObj = parseXmlFile('es_settings.cfg');
    const settings = {};
    const config = xmlObj.config || {};
    
    const processElements = (type) => {
      const elements = config[type];
      if (elements) {
        const list = Array.isArray(elements) ? elements : [elements];
        list.forEach((s) => {
          settings[s['@_name']] = { value: s['@_value'], type };
        });
      }
    };

    processElements('bool');
    processElements('string');
    processElements('int');
    processElements('float');

    writeJsonFile('settings.json', settings);
  } catch (err) {
    console.error('Failed to convert settings:', err);
  }
}

// 2. Convert systems (with overrides merging)
if (exists('es_systems.cfg')) {
  try {
    const parseSystemFile = (file) => {
      const xmlObj = parseXmlFile(file);
      const systemList = xmlObj.systemList?.system;
      if (!systemList) return [];
      const list = Array.isArray(systemList) ? systemList : [systemList];
      
      return list.map((s) => {
        const parseEmulators = (emulators) => {
          if (!emulators || !emulators.emulator) return [];
          const emuList = Array.isArray(emulators.emulator) ? emulators.emulator : [emulators.emulator];
          return emuList.map((e) => ({
            name: e['@_name'],
            cores: e.cores?.core ? (Array.isArray(e.cores.core) ? e.cores.core : [e.cores.core]) : []
          }));
        };

        return {
          name: String(s.name),
          fullname: String(s.fullname || s.name),
          path: String(s.path),
          extension: String(s.extension || ''),
          command: String(s.command || ''),
          platform: String(s.platform || ''),
          theme: String(s.theme || s.name),
          hardware: String(s.hardware || ''),
          group: s.group ? String(s.group) : undefined,
          emulators: parseEmulators(s.emulators)
        };
      });
    };

    const mainSystems = parseSystemFile('es_systems.cfg');
    const systemMap = new Map();
    mainSystems.forEach(sys => systemMap.set(sys.name.toLowerCase(), sys));

    // Handle overrides
    const files = fs.readdirSync(configsDir);
    files.forEach(f => {
      if (f.startsWith('es_systems_') && f.endsWith('.cfg')) {
        console.log(`Merging override systems from: ${f}`);
        const overrideSystems = parseSystemFile(f);
        overrideSystems.forEach(sys => {
          systemMap.set(sys.name.toLowerCase(), sys);
        });
      }
    });

    writeJsonFile('systems.json', { systems: Array.from(systemMap.values()) });
  } catch (err) {
    console.error('Failed to convert systems:', err);
  }
}

// 3. Convert features
if (exists('es_features.cfg')) {
  try {
    const xmlObj = parseXmlFile('es_features.cfg');
    const features = xmlObj.features || {};

    const cleanFeatureList = (list) => {
      if (!list) return undefined;
      const arr = Array.isArray(list) ? list : [list];
      return arr.map(f => {
        const cleaned = {
          name: f['@_name'],
          value: f['@_value'],
          description: f['@_description'],
          preset: f['@_preset'],
          submenu: f['@_submenu'],
          group: f['@_group'],
          order: f['@_order']
        };
        if (f.choice) {
          const choices = Array.isArray(f.choice) ? f.choice : [f.choice];
          cleaned.choices = choices.map(c => ({
            name: c['@_name'],
            value: String(c['@_value'])
          }));
        }
        return cleaned;
      });
    };

    const cleanSharedFeatureList = (list) => {
      if (!list) return undefined;
      const arr = Array.isArray(list) ? list : [list];
      return arr.map(sf => ({
        name: sf['@_name'],
        value: sf['@_value'],
        group: sf['@_group'],
        submenu: sf['@_submenu'],
        order: sf['@_order']
      }));
    };

    const cleanSharedFeatures = (sf) => {
      if (!sf) return undefined;
      return {
        featuresList: cleanFeatureList(sf.feature)
      };
    };

    const cleanGlobalFeatures = (gf) => {
      if (!gf) return undefined;
      return {
        featuresList: cleanFeatureList(gf.feature),
        sharedFeatures: cleanSharedFeatureList(gf.sharedFeature)
      };
    };

    const cleanEmulators = (emulators) => {
      if (!emulators) return undefined;
      const arr = Array.isArray(emulators) ? emulators : [emulators];
      return arr.map(emu => {
        const cleanSystems = (systems) => {
          if (!systems) return undefined;
          const sArr = Array.isArray(systems) ? systems : [systems];
          return sArr.map(s => ({
            name: s['@_name'],
            features: s['@_features'],
            sharedFeatures: cleanSharedFeatureList(s.sharedFeature),
            featuresList: cleanFeatureList(s.feature)
          }));
        };

        const cleanCores = (cores) => {
          if (!cores) return undefined;
          const cArr = Array.isArray(cores) ? cores : [cores];
          return cArr.map(c => ({
            name: c['@_name'],
            features: c['@_features'],
            sharedFeatures: cleanSharedFeatureList(c.sharedFeature),
            featuresList: cleanFeatureList(c.feature),
            systems: cleanSystems(c.system)
          }));
        };

        return {
          name: emu['@_name'],
          features: emu['@_features'],
          sharedFeatures: cleanSharedFeatureList(emu.sharedFeature),
          featuresList: cleanFeatureList(emu.feature),
          systems: cleanSystems(emu.system),
          cores: cleanCores(emu.core)
        };
      });
    };

    const cleanedFeatures = {
      sharedFeatures: cleanSharedFeatures(features.sharedFeatures),
      globalFeatures: cleanGlobalFeatures(features.globalFeatures),
      emulators: cleanEmulators(features.emulator)
    };

    writeJsonFile('features.json', cleanedFeatures);
  } catch (err) {
    console.error('Failed to convert features:', err);
  }
}

// 4. Convert input configs
if (exists('es_input.cfg')) {
  try {
    const xmlObj = parseXmlFile('es_input.cfg');
    const inputList = xmlObj.inputList || {};
    const inputConfig = inputList.inputConfig || [];
    const arr = Array.isArray(inputConfig) ? inputConfig : [inputConfig];
    
    const cleanedInputs = arr.map(cfg => {
      const inputs = cfg.input ? (Array.isArray(cfg.input) ? cfg.input : [cfg.input]) : [];
      return {
        type: cfg['@_type'],
        deviceName: cfg['@_deviceName'],
        deviceGUID: cfg['@_deviceGUID'],
        inputs: inputs.map(i => ({
          name: i['@_name'],
          type: i['@_type'],
          id: i['@_id'],
          value: i['@_value']
        }))
      };
    });

    writeJsonFile('input.json', { inputConfigs: cleanedInputs });
  } catch (err) {
    console.error('Failed to convert inputs:', err);
  }
}

// 5. Convert padtokey
if (exists('es_padtokey.cfg')) {
  try {
    const xmlObj = parseXmlFile('es_padtokey.cfg');
    const padToKey = xmlObj.padToKey || {};
    const app = padToKey.app || [];
    const arr = Array.isArray(app) ? app : [app];

    const cleanedApps = arr.map(a => {
      const inputs = a.input ? (Array.isArray(a.input) ? a.input : [a.input]) : [];
      return {
        name: a['@_name'],
        inputs: inputs.map(i => ({
          name: i['@_name'],
          key: i['@_key'],
          code: i['@_code']
        }))
      };
    });

    writeJsonFile('padtokey.json', { applications: cleanedApps });
  } catch (err) {
    console.error('Failed to convert padtokey:', err);
  }
}

// 6. Convert savestates
if (exists('es_savestates.cfg')) {
  try {
    const xmlObj = parseXmlFile('es_savestates.cfg');
    const root = xmlObj.savestates || {};
    const emus = root.emulator || [];
    const arr = Array.isArray(emus) ? emus : [emus];

    const cleanedEmulators = arr.map(e => ({
      name: e['@_name'],
      directory: e['@_directory'],
      defaultCoreDirectory: e['@_defaultCoreDirectory'],
      incremental: e['@_incremental'] === true || String(e['@_incremental']) === 'true',
      autosave: e['@_autosave'] === true || String(e['@_autosave']) === 'true',
      firstslot: parseInt(e['@_firstslot'] || 0, 10),
      lastslot: parseInt(e['@_lastslot'] || 999999, 10),
      file: e['@_file'],
      image: e['@_image'],
      autosave_file: e['@_autosave_file'],
      autosave_image: e['@_autosave_image']
    }));

    writeJsonFile('savestates.json', { emulators: cleanedEmulators });
  } catch (err) {
    console.error('Failed to convert savestates:', err);
  }
}

console.log('XML -> JSON migration script run completed!');

