import path from 'path';
import fs from 'fs';
import { EOL } from 'os';
import {
  crtoOneOperatorConfig,
  pafCmpConfig,
  pafDemoPublisherConfig,
  pafMarketConfig,
  pifCmpConfig,
  pifDemoPublisherConfig,
  pifMarketConfig,
  pofCmpConfig,
  pofDemoPublisherConfig,
  pofMarketConfig,
  portalConfig,
  PublicConfig,
} from '../src/config';
import { criteoTestPAFClientPublicConfig } from '../src/criteo-paf-client-test';

if (!(process.argv[2]?.length > 0)) {
  const scriptName = path.basename(__filename);
  console.error(`Usage: sudo ts-node ${scriptName} <add|remove>
Example: sudo ts-node ${scriptName} add`);
  process.exit(1);
}

const pattern = '# [PAF]';

const action = process.argv[2];

const hostsFile = '/etc/hosts';

(async () => {
  let content = (await fs.promises.readFile(hostsFile))
    .toString()
    .split(EOL)
    .filter((n) => !n.includes(pattern))
    .join(EOL);

  if (action === 'remove') {
    // The content is already cleaned
  } else if (action == 'add') {
    const addConfig = (config: PublicConfig) => {
      content += `127.0.0.1 ${config.host} ${pattern} ${config.name}${EOL}`;
      if (config.cdnHost) {
        content += `127.0.0.1 ${config.cdnHost} ${pattern} ${config.name} (CDN)${EOL}`;
      }
    };
    addConfig(crtoOneOperatorConfig);
    addConfig(portalConfig);
    addConfig(pafMarketConfig);
    addConfig(pifMarketConfig);
    addConfig(pofMarketConfig);
    addConfig(pafDemoPublisherConfig);
    addConfig(pifDemoPublisherConfig);
    addConfig(pofDemoPublisherConfig);
    addConfig(pafCmpConfig);
    addConfig(pifCmpConfig);
    addConfig(pofCmpConfig);
    addConfig(criteoTestPAFClientPublicConfig);
  } else {
    console.error(`Unsupported action ${action}`);
    process.exit(1);
  }

  await fs.promises.writeFile(hostsFile, content);

  process.exit(0);
})();
