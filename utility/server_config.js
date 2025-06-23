import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath = path.join(__dirname, '../servers');

const defaultConfig = {
	serverId: 0,
	users: {}
};

export function loadConfig(serverId) {
	if (!fs.existsSync(path.join(configPath, serverId.toString()))) {
		fs.mkdirSync(path.join(configPath, serverId.toString()), { recursive: true });
		fs.writeFileSync(path.join(configPath, serverId.toString(), 'config.json'), JSON.stringify(defaultConfig, null, 2));
	}

	return JSON.parse(fs.readFileSync(path.join(configPath, serverId.toString(), 'config.json'), 'utf-8'));
}

export function writeToConfig(serverId, newConfig) {
	if (!fs.existsSync(path.join(configPath, serverId.toString()))) {
		fs.mkdirSync(path.join(configPath, serverId.toString()), { recursive: true });
		fs.writeFileSync(path.join(configPath, serverId.toString(), 'config.json'), JSON.stringify(defaultConfig, null, 2));
	}

	fs.writeFileSync(path.join(configPath, serverId.toString(), 'config.json'), JSON.stringify(newConfig, null, 2));
}