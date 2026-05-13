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

			return list.map((g: any) => ({
				id: g['@_id'] || g.path,
				name: g.name,
				desc: g.desc,
				image: resolveMedia(g.image),
				video: resolveMedia(g.video),
				marquee: resolveMedia(g.marquee),
				thumbnail: resolveMedia(g.thumbnail),
				fanart: resolveMedia(g.fanart),
				titleshot: resolveMedia(g.titleshot),
				wheel: resolveMedia(g.wheel),
				rating: g.rating ? parseFloat(g.rating) : undefined,
				releasedate: g.releasedate,
				developer: g.developer,
				publisher: g.publisher,
				genre: g.genre,
				players: g.players,
				favorite: g.favorite === 'true' || g.favorite === true,
				hidden: g.hidden === 'true' || g.hidden === true,
				kidgame: g.kidgame === 'true' || g.kidgame === true,
				playcount: g.playcount ? parseInt(g.playcount) : 0,
				lastplayed: g.lastplayed,
				path: g.path,
				genreId: g.genreId,
				system: systemName,
				emulator: g.emulator,
			}));
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
				const xmlGame: any = {
					path: g.path,
					name: g.name,
					desc: g.desc,
					image: g.image,
					video: g.video,
					marquee: g.marquee,
					thumbnail: g.thumbnail,
					rating: g.rating,
					releasedate: g.releasedate,
					developer: g.developer,
					publisher: g.publisher,
					genre: g.genre,
					players: g.players,
					favorite: g.favorite ? 'true' : 'false',
					playcount: g.playcount,
					lastplayed: g.lastplayed,
				};
				if (g.emulator) xmlGame.emulator = g.emulator;
				if (g.id && g.id !== g.path) xmlGame['@_id'] = g.id;
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
