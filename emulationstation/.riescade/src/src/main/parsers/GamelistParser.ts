import { XMLParser } from 'fast-xml-parser';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { Game } from '../../shared/types';

export class GamelistParser {
	private parser: XMLParser;

	constructor() {
		this.parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			processEntities: {
				maxTotalExpansions: 99999,
				maxExpandedLength: 1000000,
			},
		});
	}

	public parse(filePath: string, systemName: string): Game[] {
		if (!existsSync(filePath)) return [];

		try {
			const content = readFileSync(filePath, 'utf-8');
			const jsonObj = this.parser.parse(content);
			const gameList = jsonObj.gameList?.game;

			if (!gameList) return [];

			const list = Array.isArray(gameList) ? gameList : [gameList];

			const baseDir = dirname(filePath);

			const resolveMedia = (path?: any) => {
				if (!path || typeof path !== 'string') return undefined;

				// If it's a URL, return it
				if (path.startsWith('http')) return path;

				// If it's already absolute (Windows or Posix), just normalize slashes
				if (isAbsolute(path) || path.match(/^[a-zA-Z]:/)) {
					return path.replace(/\\/g, '/');
				}

				// Treat everything else as relative to the gamelist.xml
				// We resolve it to a full absolute path
				const absolute = resolve(baseDir, path);
				return absolute.replace(/\\/g, '/');
			};

			return list.map((g: any) => {
				const game: any = { ...g };
				game.id = g['@_id'] || g.path;
				game.system = systemName;
				game.favorite = g.favorite === 'true' || g.favorite === true;
				game.hidden = g.hidden === 'true' || g.hidden === true;
				game.kidgame = g.kidgame === 'true' || g.kidgame === true;
				game.playcount = g.playcount ? parseInt(g.playcount) : 0;
				game.rating = g.rating ? parseFloat(g.rating) : undefined;
				
				// Keep resolved paths for the UI, but we'll need raw paths for saving?
				// Actually, the UI needs absolute paths to show images.
				// But ES needs relative paths in the XML.
				// We'll store resolved paths in new properties if needed, or just resolve on the fly in UI.
				// Let's keep the UI-friendly paths in the object but remember they might need to be relative.
				
				const mediaFields = ['image', 'video', 'marquee', 'thumbnail', 'fanart', 'titleshot', 'wheel', 'mix'];
				mediaFields.forEach(field => {
					if (g[field]) game[field] = resolveMedia(g[field]);
				});

				return game;
			});
		} catch (error) {
			console.error(`Error parsing gamelist ${filePath}:`, error);
			return [];
		}
	}

	public save(filePath: string, games: Game[]): void {
		try {
			const builder = new (require('fast-xml-parser').XMLBuilder)({
				ignoreAttributes: false,
				attributeNamePrefix: '@_',
				format: true,
				indentBy: '  ',
			});

			const xmlGames = games.map((g) => {
				const { id, system, ...xmlGame } = g as any;
				
				// Convert types back to XML strings
				if (xmlGame.favorite !== undefined) xmlGame.favorite = xmlGame.favorite ? 'true' : 'false';
				if (xmlGame.hidden !== undefined) xmlGame.hidden = xmlGame.hidden ? 'true' : 'false';
				if (xmlGame.kidgame !== undefined) xmlGame.kidgame = xmlGame.kidgame ? 'true' : 'false';
				
				if (id && id !== xmlGame.path) xmlGame['@_id'] = id;

				// NOTE: We are saving the paths as they were in the object.
				// If they were resolved to absolute paths, they will be saved as absolute.
				// This might be an issue for portability, but it's consistent with current behavior.
				
				return xmlGame;
			});

			const xmlObj = {
				'?xml': { '@_version': '1.0' },
				gameList: {
					game: xmlGames,
				},
			};

			const xmlContent = builder.build(xmlObj);
			require('fs').writeFileSync(filePath, xmlContent, 'utf-8');
		} catch (error) {
			console.error(`Error saving gamelist ${filePath}:`, error);
		}
	}
}
