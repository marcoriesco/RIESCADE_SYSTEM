using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Windows.Forms;
using System.Reflection;
using EmulatorLauncher.Common.FileFormats;
using EmulatorLauncher.Common.EmulationStation;
using EmulatorLauncher.Common;
using Newtonsoft.Json;

namespace EmulatorLauncher.PadToKeyboard
{
    public class PadToKey
    {
        public static PadToKey Load(string jsonFile)
        {
            if (!File.Exists(jsonFile))
                return null;

            try
            {
                string json = File.ReadAllText(jsonFile);
                PadToKey ret = JsonConvert.DeserializeObject<PadToKey>(json);
                if (ret != null)
                {
                    SimpleLogger.Instance.Info("[PadToKey] Loaded " + jsonFile);               
                    return ret;
                }
            }
            catch (Exception ex)
            {
#if DEBUG
                MessageBox.Show("[PadToKey] Error :\r\n" + ex.Message);
#endif
                SimpleLogger.Instance.Error("[PadToKey] Error : " + ex.Message, ex);               
            }

            return null;
        }

        public PadToKeyApp this[string process]
        {
            get
            {
                if (string.IsNullOrEmpty(process))
                    return null;

                process = process.ToLowerInvariant();
                var ret = Applications.FirstOrDefault(i => i.ProcessNames.Contains(process));
                if (ret != null)
                    return ret;

                return null;
            }
        }

        [JsonProperty("applications")]
        public List<PadToKeyApp> Applications
        {
            get 
            {
                if (_applications == null)
                    _applications = new List<PadToKeyApp>();

                return _applications; 
            }
            set { _applications = value; }
        }

        public string ForceApplyToProcess { get; set; }

        public static PadToKey AddOrUpdateKeyMapping(PadToKey mapping, string processName, InputKey inputKey, Action action = null)
        {
            return AddOrUpdateKeyMapping(mapping, processName, inputKey, null, action);
        }

        public static PadToKey AddOrUpdateKeyMapping(PadToKey mapping, string processName, InputKey inputKey, string key, Action action = null)
        {
            if (string.IsNullOrEmpty(processName))
                return mapping;

            if (Program.Controllers.Count(c => c.Config != null && c.Config.DeviceName != "Keyboard") == 0)
                return mapping;

            if (mapping == null)
                mapping = new PadToKeyboard.PadToKey();

            PadToKeyInput input = null;
            PadToKeyApp app = null;

            if (mapping != null && mapping[processName] != null)
            {
                app = mapping[processName];
                input = app[inputKey];
            }

            if (app == null)
            {
                app = new PadToKeyApp() { Name = processName };
                mapping.Applications.Add(app);
            }

            if (input == null)
            {
                input = new PadToKeyInput();
                input.Name = inputKey;
                app.Input.Add(input);
            }

            input.Type = PadToKeyType.Keyboard;
            input.Key = key;
            input.Action = action;

            return mapping;
        }

        private List<PadToKeyApp> _applications;
    }

    public class PadToKeyApp
    {
        public override string ToString()
        {
            return Name;
        }

        private List<string> _processNames;

        public List<string> ProcessNames
        {
            get
            {
                if (_processNames == null)
                {
                    _processNames = new List<string>();

                    if (this.Name != null)
                        foreach (var nm in Name.ToLowerInvariant().Split(new char[] { ',' }))
                            _processNames.Add(nm.Trim());
                }

                return _processNames;
            }
        }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("inputs")]
        public List<PadToKeyInput> Input 
        {
            get 
            {
                if (_input == null)
                    _input = new List<PadToKeyInput>();

                return _input; 
            }
            set { _input = value; }
        }

        private List<PadToKeyInput> _input;

        public PadToKeyInput this[InputKey key]
        {
            get
            {
                return Input.FirstOrDefault(i => i.Name == key);
            }
        }

    }

    public enum PadToKeyType
    {
        Keyboard,
        Mouse
    }

    public class PadToKeyInput
    {
        public PadToKeyInput()
        {
            Type = PadToKeyType.Keyboard;
            ControllerIndex = -1;
        }

        [JsonProperty("name")]
        public InputKey Name { get; set; }

        [JsonProperty("key")]
        public string Key { get; set; }

        [JsonProperty("code")]
        public string Code { get; set; }

        public PadToKeyType Type { get; set; }

        public int ControllerIndex { get; set; }

        public bool IsValid()
        {
             return !string.IsNullOrEmpty(Key) || ScanCodes.Length >= 0;
        }

        public Keys Keys
        {
            get
            {
                if (string.IsNullOrEmpty(Key) || Key.StartsWith("{") || Key.StartsWith("("))
                    return Keys.None;

                Keys ret = Keys.None;
                Enum.TryParse(Key, out ret);
                return ret;
            }
        }

        public uint[] ScanCodes
        {
            get
            {
                if (_scanCodes != null)
                    return _scanCodes.ToArray();

                if (string.IsNullOrEmpty(Code))
                    return new uint[] { };

                HashSet<uint> values = new HashSet<uint>();

                var codes = Code.ToLowerInvariant().Split(new char[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries);
                string code = Code.ToLowerInvariant();

                /*
                InputKey k;
                if (!Enum.TryParse<InputKey>(string.Join(", ", action.Triggers.ToArray()).ToLower(), out k))
                    continue;
                */

                foreach (var fld in typeof(LinuxScanCode).GetFields(BindingFlags.Static | BindingFlags.Public))
                    if (fld.Name.ToLowerInvariant() == code)
                        values.Add((uint)fld.GetValue(null));

                foreach (var fld in typeof(ScanCode).GetFields(BindingFlags.Static | BindingFlags.Public))
                    if (fld.Name.ToLowerInvariant() == code || fld.Name.ToLowerInvariant() == "key_" + code)
                        values.Add((uint)fld.GetValue(null));

                return values.ToArray();
            }
        }

        List<uint> _scanCodes;

        public void SetScanCode(uint scanCode)
        {
            if (_scanCodes == null)
                _scanCodes = new List<uint>();

            _scanCodes.Add(scanCode);
        }

        public override string ToString()
        {
            StringBuilder sb = new StringBuilder();

            sb.Append(" name:" + Name);

            if (Key != null)
                sb.Append(" key:" + Key);

            return sb.ToString().Trim();
        }

        public Action Action { get; set; }
    }
}

