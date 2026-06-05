using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Windows.Forms;
using System.Xml.Linq;
using EmulatorLauncher.Common.FileFormats;
using Newtonsoft.Json;

namespace EmulatorLauncher.Common.EmulationStation
{
    public class EsFeatures
    {
        private HashSet<string> _contextFeatures;

        public bool IsSupported(string name)
        {
            if (_contextFeatures == null)
                return true;

            if (!_contextFeatures.Contains(name))
                return false;

            return true;
        }

        public void SetFeaturesContext(string system, string emulator, string core)
        {
            HashSet<string> ret = new HashSet<string>();

            if (this.GlobalFeatures != null)
            {
                foreach (var s in this.GlobalFeatures.GetAllFeatureNames(this.SharedFeatures))
                    ret.Add(s);
            }
            
            if (this.Emulators != null && !string.IsNullOrEmpty(emulator))
            {
                foreach (var emul in Emulators.Where(e => NameContains(e.Name, emulator)))
                {
                    foreach (var name in emul.GetAllFeatureNames(this.SharedFeatures))
                        ret.Add(name);

                    if (emul.Systems != null && !string.IsNullOrEmpty(system))
                    {
                        foreach (var sys in emul.Systems.Where(c => NameContains(c.Name, system)))
                            foreach (var name in sys.GetAllFeatureNames(this.SharedFeatures))
                                ret.Add(name);
                    }

                    if (emul.Cores != null && !string.IsNullOrEmpty(core))
                    {
                        foreach (var corr in emul.Cores.Where(c => NameContains(c.Name, core)))
                        {
                            foreach (var name in corr.GetAllFeatureNames(this.SharedFeatures))
                                ret.Add(name);

                            if (corr.Systems != null && !string.IsNullOrEmpty(system))
                            {
                                foreach (var sys in corr.Systems.Where(c => NameContains(c.Name, system)))
                                    foreach (var name in sys.GetAllFeatureNames(this.SharedFeatures))
                                        ret.Add(name);
                            }
                        }
                    }
                }
            }

            _contextFeatures = ret;
        }

        private static bool NameContains(string a, string b)
        {
            if (a != null && a.Contains(","))
                return a.Split(new char[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries).Contains(b);

            return a == b;
        }

        public static EsFeatures Load(string jsonFile)
        {
            var defaultFeatures = new EsFeatures();
            defaultFeatures._contextFeatures = new HashSet<string>();

            foreach (var s in new string[] { 
                    "ratio",
                    "rewind",
                    "smooth",
                    "shaders",
                    "pixel_perfect",
                    "decoration",
                    "latency_reduction",
                    "game_translation",
                    "autosave",
                    "netplay",
                    "fullboot",
                    "emulated_wiimotes",
                    "screen_layout",
                    "internal_resolution",
                    "videomode",
                    "colorization",
                    "padtokeyboard",
                    "cheevos",
                    "softpatch",
                    "autocontrollers"})
                defaultFeatures._contextFeatures.Add(s);

            if (!File.Exists(jsonFile))
                return defaultFeatures;            

            try
            {
                string json = File.ReadAllText(jsonFile);
                EsFeatures ret = JsonConvert.DeserializeObject<EsFeatures>(json);
                if (ret != null)
                    return ret;

                SimpleLogger.Instance.Warning("[Features] features.json file is null. Using default features");
            }
            catch (Exception ex)
            {
                SimpleLogger.Instance.Error("[Features] features.json file is invalid : " + ex.Message);
                throw ex;
            }

            return defaultFeatures;
        }

        [JsonProperty("sharedFeatures")]
        public FeatureCollection SharedFeatures { get; set; }

        [JsonProperty("globalFeatures")]
        public FeatureCollection GlobalFeatures { get; set; }

        [JsonProperty("emulators")]
        public Emulator[] Emulators { get; set; }
    }

    public class Emulator : FeatureCollection
    {
        public override string ToString()
        {
            return "<emulator name=\"" + (Name ?? "null") + "\" />";
        }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("systems")]
        public Systeme[] Systems { get; set; }

        [JsonProperty("cores")]
        public Core[] Cores { get; set; }    
    }

    public class Core : FeatureCollection
    {
        public override string ToString()
        {
            return "<core name=\"" + (Name ?? "null") + "\" />";
        }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("systems")]
        public Systeme[] Systems { get; set; }
    }

    public class Feature
    {
        public override string ToString()
        {
            return "<feature value=\"" + (Value??"null") + "\" />";
        }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("value")]
        public string Value { get; set; }

        [JsonProperty("description")]
        public string Description { get; set; }

        [JsonProperty("choices")]
        public Choice[] Choice { get; set; }

        [JsonProperty("submenu")]
        public string SubMenu { get; set; }

        [JsonProperty("preset")]
        public string preset { get; set; }
    }

    public class Choice
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("value")]
        public string Value { get; set; }
    }

    public class Systeme : FeatureCollection
    {
        [JsonProperty("name")]
        public string Name { get; set; }
    }

    public class FeatureCollection
    {
        [JsonProperty("features")]
        public string CommonFeatures { get; set; }

        [JsonProperty("featuresList")]
        public Feature[] Features { get; set; }

        [JsonProperty("sharedFeatures")]
        public Feature[] SharedFeatures { get; set; }

        public string[] GetAllFeatureNames(FeatureCollection sharedFeatures)
        {
            List<string> ret = new List<string>();

            if (CommonFeatures != null)
            {
                foreach (var name in CommonFeatures.Split(new char[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries))
                    ret.Add(name);
            }

            if (Features != null)
            {
                foreach (var feat in Features)
                    if (!string.IsNullOrEmpty(feat.Value) && !string.IsNullOrEmpty(feat.Name) && ((feat.Choice != null && feat.Choice.Any()) || !string.IsNullOrEmpty(feat.preset)))
                        ret.Add(feat.Value);
            }

            if (SharedFeatures != null && sharedFeatures != null && sharedFeatures.Features != null)
            {
                foreach (var sf in SharedFeatures)
                {
                    Feature feat = null;

                    if (!string.IsNullOrEmpty(sf.Value))
                        feat = sharedFeatures.Features.FirstOrDefault(f => f.Value == sf.Value);

                    if (feat == null && !string.IsNullOrEmpty(sf.Name))
                        feat = sharedFeatures.Features.FirstOrDefault(f => f.Name == sf.Name);

                    if (feat != null)
                        ret.Add(feat.Value);
                }
            }

            return ret.ToArray();
        }
    }
}

