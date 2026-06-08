using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Diagnostics;
using System.ComponentModel;
using EmulatorLauncher.Common;
using EmulatorLauncher.Common.FileFormats;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace EmulatorLauncher.Common.EmulationStation
{
    public class EsSystems : IRelativePath
    {
        public EsSystems()
        {
            Systems = new List<EsSystem>();
        }

        public EsSystem this[string key]
        {
            get
            {
                return Systems.FirstOrDefault(sys => sys.Name == key);
            }
        }

        public List<EsSystem> Systems { get; set; }
        
        public static EsSystems Load(string filename)
        {
            if (!File.Exists(filename))
                return null;

            try
            {
                string json = File.ReadAllText(filename);
                EsSystems gl = JsonConvert.DeserializeObject<EsSystems>(json);
                if (gl == null)
                    return null;

                ((IRelativePath)gl).FilePath = Path.GetDirectoryName(filename);
                if (gl.Systems != null)
                {
                    gl.Systems.ForEach(s => s.RelativePath = gl);
                }

                return gl;
            }
            catch (Exception ex)
            {
                SimpleLogger.Instance.Error("[EsSystems] Error loading " + filename + ": " + ex.Message, ex);
                return null;
            }
        }
     
        string IRelativePath.FilePath { get; set; }        
    }

    [JsonConverter(typeof(EsCoreConverter))]
    public class EsCore
    {
        public override string ToString()
        {
            return Name;
        }

        public string Name { get; set; }

        [DefaultValue(false)]
        public bool Default { get; set; }

        public string EmulatorName { get; set; }
    }

    public class EsEmulator
    {
        public string Name { get; set; }

        public string Command { get; set; }

        public List<EsCore> Cores { get; set; }

        [JsonProperty("source")]
        public string Source { get; set; }
    }

    public class EsSystem
    {
        internal IRelativePath RelativePath { get; set; }

        public override string ToString()
        {
            if (!string.IsNullOrEmpty(FullName))
                return FullName;

            return Name;
        }

        public string DefaultEmulator
        {
            get
            {
                if (Emulators == null || Emulators.Count == 0)
                    return null;

                foreach (var emul in Emulators)
                {
                    if (emul.Cores == null)
                        continue;

                    foreach (var core in emul.Cores)
                        if (core.Default)
                            return emul.Name;
                }

                return Emulators.FirstOrDefault().Name;
            }
        }

        public string DefaultCore
        {
            get 
            {   
                if (Emulators == null || Emulators.Count == 0)
                    return null;

	            var emul = DefaultEmulator;
	            if (string.IsNullOrEmpty(emul))
		            return null;
	
	            foreach (var it in Emulators)
	            {
                    if (it.Name != emul)
                        continue;

                    if (it.Cores == null || it.Cores.Count == 0)
                        continue;

			        foreach (var core in it.Cores)
				        if (core.Default)
					        return core.Name;

                    return it.Cores.FirstOrDefault().Name;
	            }	

	            return "";
            }
        }

        public string Name { get; set; }

        public string FullName { get; set; }

        public string Path { get; set; }

        public string Extension { get; set; }

        public string Command { get; set; }

        public string Platform { get; set; }

        public string Theme { get; set; }

        public string Manufacturer { get; set; }
        
        public List<EsEmulator> Emulators { get; set; }

        private GameList _gameList;

        public GameList GameList
        {
            get 
            {
                if (_gameList == null)
                {                    
                    string path = System.IO.Path.Combine(RomPath, "gamelist.xml");
                    _gameList = GameList.Load(path);                    
                }

                return _gameList; 
            }            
        }

        public bool IsGameListLoaded() { return _gameList != null; }

        public string RomPath
        {
            get
            {
                return System.IO.Path.GetFullPath(GameList.FormatPath(Path, RelativePath));               
            }
        }
    }

    public class EsCoreConverter : Newtonsoft.Json.JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return objectType == typeof(EsCore);
        }

        public override object ReadJson(Newtonsoft.Json.JsonReader reader, Type objectType, object existingValue, Newtonsoft.Json.JsonSerializer serializer)
        {
            JToken token = JToken.Load(reader);
            if (token.Type == JTokenType.String)
            {
                return new EsCore { Name = token.ToString() };
            }
            else if (token.Type == JTokenType.Object)
            {
                var core = new EsCore();
                var nameToken = token["#text"] ?? token["Name"] ?? token["name"];
                if (nameToken != null)
                    core.Name = nameToken.ToString();

                var defaultToken = token["@_default"] ?? token["Default"] ?? token["default"];
                if (defaultToken != null)
                    core.Default = defaultToken.Value<bool>();

                return core;
            }
            return null;
        }

        public override void WriteJson(Newtonsoft.Json.JsonWriter writer, object value, Newtonsoft.Json.JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }
    }
}
