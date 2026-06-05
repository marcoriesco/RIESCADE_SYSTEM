using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using Newtonsoft.Json;

namespace EmulatorLauncher.Common.EmulationStation
{
    public class EsSaveStates
    {
        public SaveStateEmulatorInfo this[string key]
        {
            get
            {
                if (Emulators != null)
                    return Emulators.FirstOrDefault(sys => sys.Name == key);

                return null;
            }
        }

        [JsonProperty("emulators")]
        public SaveStateEmulatorInfo[] Emulators { get; set; }

        public static EsSaveStates Load(string filename)
        {
            var ret = new EsSaveStates();

            try
            {
                if (File.Exists(filename))
                {
                    string json = File.ReadAllText(filename);
                    ret = JsonConvert.DeserializeObject<EsSaveStates>(json);
                }
            }
            catch { }

            return ret;
        }
        
        public bool IsEmulatorSupported(string emulator)
        {
            return this[emulator] != null;
        }
    }

    public class SaveStateEmulatorInfo
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("directory")]
        public string Directory { get; set; }

        [JsonProperty("defaultCoreDirectory")]
        public string DefaultCoreDirectory { get; set; }
        
        [JsonProperty("incremental")]
        public bool Incremental { get; set; }

        [JsonProperty("autosave")]
        public bool AutoSave { get; set; }

        [JsonProperty("firstslot")]
        public int FirstSlot { get; set; }

        [JsonProperty("lastslot")]
        public int LastSlot { get; set; }

        [JsonProperty("file")]
        public string FilePattern { get; set; }

        [JsonProperty("image")]
        public string ImagePattern { get; set; }

        [JsonProperty("autosave_file")]
        public string AutoFilePattern { get; set; }

        [JsonProperty("autosave_image")]
        public string AutoImagePattern { get; set; }

        public override string ToString()
        {
            return Name.ToString();
        }
    }
}

