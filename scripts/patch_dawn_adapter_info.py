from pathlib import Path
import re


path = Path("/source/emdawnwebgpu_pkg/webgpu/src/library_webgpu.js")
text = path.read_text()
pattern = r"(?ms)^(\s*fillAdapterInfoStruct:\s*\(info,\s*infoStruct\)\s*=>\s*\{\n)(.*?)(^\s*\}\,\n)"
replacement_body = """      {{{ gpu.makeCheckDescriptor('infoStruct') }}}

      var subgroupMinSize = info.subgroupMinSize ?? 0;
      var subgroupMaxSize = info.subgroupMaxSize ?? 0;
      var vendor = info.vendor ?? '';
      var architecture = info.architecture ?? '';
      var device = info.device ?? '';
      var description = info.description ?? '';

      // Populate subgroup limits.
      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.subgroupMinSize, 'subgroupMinSize', 'u32') }}};
      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.subgroupMaxSize, 'subgroupMaxSize', 'u32') }}};

      // Append all the strings together to condense into a single malloc.
      var strs = vendor + architecture + device + description;
      var strPtr = stringToNewUTF8(strs);

      var vendorLen = lengthBytesUTF8(vendor);
      WebGPU.setStringView(infoStruct + {{{ C_STRUCTS.WGPUAdapterInfo.vendor }}}, strPtr, vendorLen);
      strPtr += vendorLen;

      var architectureLen = lengthBytesUTF8(architecture);
      WebGPU.setStringView(infoStruct + {{{ C_STRUCTS.WGPUAdapterInfo.architecture }}}, strPtr, architectureLen);
      strPtr += architectureLen;

      var deviceLen = lengthBytesUTF8(device);
      WebGPU.setStringView(infoStruct + {{{ C_STRUCTS.WGPUAdapterInfo.device }}}, strPtr, deviceLen);
      strPtr += deviceLen;

      var descriptionLen = lengthBytesUTF8(description);
      WebGPU.setStringView(infoStruct + {{{ C_STRUCTS.WGPUAdapterInfo.description }}}, strPtr, descriptionLen);
      strPtr += descriptionLen;

      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.backendType, gpu.BackendType.WebGPU, 'i32') }}};
      var adapterType = info.isFallbackAdapter ? {{{ gpu.AdapterType.CPU }}} : {{{ gpu.AdapterType.Unknown }}};
      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.adapterType, 'adapterType', 'i32') }}};
      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.vendorID, '0', 'u32') }}};
      {{{ makeSetValue('infoStruct', C_STRUCTS.WGPUAdapterInfo.deviceID, '0', 'u32') }}};
"""


def repl(match: re.Match[str]) -> str:
    return match.group(1) + replacement_body + match.group(3)


new_text, count = re.subn(pattern, repl, text, count=1)
if count != 1:
    raise SystemExit("Expected Dawn adapter info function not found")
path.write_text(new_text)
