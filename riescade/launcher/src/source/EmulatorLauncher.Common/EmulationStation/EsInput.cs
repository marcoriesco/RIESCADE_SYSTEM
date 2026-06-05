using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Windows.Forms;
using System.Management;
using System.Text.RegularExpressions;
using System.Globalization;
using System.Diagnostics;
using EmulatorLauncher.Common.FileFormats;
using Newtonsoft.Json;

namespace EmulatorLauncher.Common.EmulationStation
{
    public class EsInput
    {
        public static InputConfig[] Load(string jsonFile)
        {
            if (!File.Exists(jsonFile))
                return null;

            try
            {
                string json = File.ReadAllText(jsonFile);
                EsInput ret = JsonConvert.DeserializeObject<EsInput>(json);
                if (ret != null)
                    return ret.InputConfigs.ToArray();
            }
            catch (Exception ex)
            {
#if DEBUG
                MessageBox.Show(ex.Message);
#endif
                SimpleLogger.Instance.Error("[InputConfig] Error : " + ex.Message);
            }

            return null;
        }

        public static InputConfig[] Parse(string jsonData)
        {
            try
            {
                EsInput ret = JsonConvert.DeserializeObject<EsInput>(jsonData);
                if (ret != null)
                    return ret.InputConfigs.ToArray();
            }
            catch (Exception ex)
            {
#if DEBUG
                MessageBox.Show(ex.Message);
#endif
                SimpleLogger.Instance.Error("[InputConfig] Error : " + ex.Message);
            }

            return null;
        }

        [JsonProperty("inputConfigs")]
        public List<InputConfig> InputConfigs { get; set; }
    }

    public class InputConfig
    {
        public override string ToString()
        {
            return DeviceName;
        }

        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("deviceName")]
        public string DeviceName { get; set; }

        [JsonProperty("deviceGUID")]
        public string DeviceGUID { get; set; }

        [JsonProperty("inputs")]
        public List<Input> Input { get; set; }

        public Input this[InputKey key]
        {
            get
            {
                return Input.FirstOrDefault(i => (int)i.Name == (int)key);
            }
        }       
    }

    public class Input
    {
        [JsonProperty("name")]
        public InputKey Name { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("id")]
        public long Id { get; set; }

        [JsonProperty("value")]
        public long Value { get; set; }

        public override string ToString()
        {
            StringBuilder sb = new StringBuilder();

            if ((int)Name != 0)
                sb.Append(" name:" + Name);

            if (Type != null)
                sb.Append(" type:" + Type);

            sb.Append(" id:" + Id);
            sb.Append(" value:" + Value);

            return sb.ToString().Trim();
        }

        public override bool Equals(object obj)
        {
            if (base.Equals(obj))
                return true;

            Input src = obj as Input;
            if (src == null)
                return false;

            return Name == src.Name && Id == src.Id && Value == src.Value && Type == src.Type;
        }

        public override int GetHashCode()
        {
            return base.GetHashCode();
        }
    }


    [Flags]
    public enum InputKey
    {
        a = 1,
        b = 2,
        x = 8388608,
        y = 16777216,

        start = 2097152,
        select = 1048576,

        up = 4194304,
        down = 4,
        left = 16,
        right = 4096,

        pageup = 512,
        pagedown = 131072,

        joystick1up = 256,
        joystick1left = 64,
        joystick1down = 32, // Virtual
        joystick1right = 128, // Virtual

        joystick2up = 8192,
        joystick2left = 32768,
        joystick2down = 16384, // Virtual
        joystick2right = 65536, // Virtual

        l2 = 1024,
        r2 = 262144,

        l3 = 2048,
        r3 = 524288,

        hotkey = 8,

        #region retrocompatible values / used for deserialisation of old es_input.cfg files
        hotkeyenable = 8,

        l1 = 512,
        r1 = 131072,

        leftanalogdown = 32,
        leftanalogleft = 64,
        leftanalogright = 128,
        leftanalogup = 256,

        rightanalogup = 8192,
        rightanalogdown = 16384,
        rightanalogleft = 32768,
        rightanalogright = 65536,

        leftthumb = 1024,
        rightthumb = 262144,

        leftshoulder = 512,
        lefttrigger = 2048,

        rightshoulder = 131072,
        righttrigger = 524288
        #endregion
    }
}
