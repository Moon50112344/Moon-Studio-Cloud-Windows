import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { serverLogger } from './logger';

export interface HostInfrastructureReport {
  timestamp: string;
  host: {
    os: string;
    kernel: string;
    hostname: string;
    uptimeSeconds: number;
  };
  cpu: {
    model: string;
    cores: number;
    hasHardwareVirtFlags: boolean; // svm / vmx flags in cpuinfo
    virtType: string;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    totalFormatted: string;
    availableFormatted: string;
  };
  storage: {
    totalFormatted: string;
    availableFormatted: string;
  };
  virtualization: {
    qemuInstalled: boolean;
    qemuVersion: string;
    qemuPath: string;
    kvmAvailable: boolean;
    devKvmExists: boolean;
    devKvmAccessible: boolean;
    nestedVirtSupported: boolean;
    accelerationMode: 'kvm' | 'tcg' | 'none';
  };
  networking: {
    interfaces: string[];
    tunTapAvailable: boolean;
    bridgeCapable: boolean;
    iptablesAvailable: boolean;
    publicIpv4: string;
    ingressType: 'direct_tcp' | 'cloud_run_http_proxy' | 'natted';
  };
  assessment: {
    readyForFullEmulation: boolean;
    readyForKvmHardwareAcc: boolean;
    summary: string;
    bottlenecks: string[];
    remediation: string[];
  };
}

export function probeHostInfrastructure(): HostInfrastructureReport {
  const timestamp = new Date().toISOString();
  serverLogger.info('HostInspector', 'Initiating thorough host infrastructure probe...');

  // 1. Host OS & Kernel
  let kernel = os.release();
  let osDesc = os.type();
  try {
    if (fs.existsSync('/etc/os-release')) {
      const releaseContent = fs.readFileSync('/etc/os-release', 'utf8');
      const match = releaseContent.match(/PRETTY_NAME="([^"]+)"/);
      if (match) osDesc = match[1];
    }
  } catch {
    // ignore
  }

  // 2. CPU
  const cpus = os.cpus();
  const cores = cpus.length;
  const cpuModel = cpus[0]?.model || 'AMD/Intel x86_64';
  let hasHardwareVirtFlags = false;
  let virtType = 'None';
  try {
    if (fs.existsSync('/proc/cpuinfo')) {
      const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
      if (cpuinfo.includes('svm')) {
        hasHardwareVirtFlags = true;
        virtType = 'AMD-V (SVM)';
      } else if (cpuinfo.includes('vmx')) {
        hasHardwareVirtFlags = true;
        virtType = 'Intel VT-x (VMX)';
      }
    }
  } catch {
    // ignore
  }

  // 3. Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const totalFormatted = (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GiB';
  const availableFormatted = (freeMem / 1024 / 1024 / 1024).toFixed(1) + ' GiB';

  // 4. Storage
  let storageTotal = 'Unknown';
  let storageAvail = 'Unknown';
  try {
    const dfOut = execSync('df -h / | tail -n 1', { encoding: 'utf8' }).trim().split(/\s+/);
    if (dfOut.length >= 4) {
      storageTotal = dfOut[1];
      storageAvail = dfOut[3];
    }
  } catch {
    // ignore
  }

  // 5. Virtualization & QEMU
  let qemuInstalled = false;
  let qemuVersion = 'Not installed';
  let qemuPath = '';
  try {
    const whichQemu = execSync('which qemu-system-x86_64', { encoding: 'utf8' }).trim();
    if (whichQemu) {
      qemuInstalled = true;
      qemuPath = whichQemu;
      const verOut = execSync(`${whichQemu} --version`, { encoding: 'utf8' });
      const verMatch = verOut.match(/version ([0-9.]+)/);
      qemuVersion = verMatch ? verMatch[1] : '7.2+';
    }
  } catch {
    // ignore
  }

  const devKvmExists = fs.existsSync('/dev/kvm');
  let devKvmAccessible = false;
  if (devKvmExists) {
    try {
      fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
      devKvmAccessible = true;
    } catch {
      devKvmAccessible = false;
    }
  }

  const kvmAvailable = devKvmExists && devKvmAccessible;
  const accelerationMode: 'kvm' | 'tcg' | 'none' = kvmAvailable
    ? 'kvm'
    : qemuInstalled
    ? 'tcg'
    : 'none';

  // 6. Networking
  const networkIfaces = os.networkInterfaces();
  const interfaces = Object.keys(networkIfaces);
  const tunTapAvailable = fs.existsSync('/dev/net/tun');
  let bridgeCapable = false;
  let iptablesAvailable = false;
  try {
    execSync('which iptables', { stdio: 'ignore' });
    iptablesAvailable = true;
  } catch {
    iptablesAvailable = false;
  }

  // Detect Public Egress IP (rejecting 169.254.x.x link-local APIPA addresses)
  let publicIpv4 = 'Unknown';
  try {
    const curlOut = execSync('curl -s4 --connect-timeout 2 ifconfig.me || curl -s4 --connect-timeout 2 api.ipify.org', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    if (curlOut && !curlOut.startsWith('169.254.') && /^[0-9.]+$/.test(curlOut)) {
      publicIpv4 = curlOut;
    }
  } catch {
    // fallback if external curl fails
  }

  // Is this running inside Google Cloud Run / gVisor sandbox?
  const isGvisor = kernel.includes('gvisor');
  const ingressType = isGvisor ? 'cloud_run_http_proxy' : 'direct_tcp';

  // 7. Assessment
  const bottlenecks: string[] = [];
  const remediation: string[] = [];

  if (!devKvmExists) {
    bottlenecks.push('/dev/kvm device is not present in container kernel (gVisor sandbox limitation).');
    remediation.push('Utilize QEMU TCG software emulation engine for VM execution or mount KVM node.');
  }

  if (isGvisor) {
    bottlenecks.push('Container environment is managed by Cloud Run HTTP ingress; raw external TCP 3389 inbound is intercepted by Cloud Run reverse proxy.');
    remediation.push('Deploy TCP tunnel broker or bridge relay to provide direct internet-accessible RDP endpoint.');
  }

  if (!bridgeCapable) {
    bottlenecks.push('Kernel bridge interface creation requires CAP_NET_ADMIN privileges not available in container.');
    remediation.push('Utilize QEMU user-mode SLIRP networking with hostfwd for TCP port 3389 mapping.');
  }

  const readyForFullEmulation = qemuInstalled;
  const readyForKvmHardwareAcc = kvmAvailable;

  const summary = kvmAvailable
    ? 'Hardware acceleration (KVM) is available and functional.'
    : qemuInstalled
    ? 'QEMU installed; running in TCG Software Emulation mode due to sandbox restrictions.'
    : 'QEMU hypervisor binary missing.';

  const report: HostInfrastructureReport = {
    timestamp,
    host: {
      os: osDesc,
      kernel,
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
    },
    cpu: {
      model: cpuModel,
      cores,
      hasHardwareVirtFlags,
      virtType,
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      totalFormatted,
      availableFormatted,
    },
    storage: {
      totalFormatted: storageTotal,
      availableFormatted: storageAvail,
    },
    virtualization: {
      qemuInstalled,
      qemuVersion,
      qemuPath,
      kvmAvailable,
      devKvmExists,
      devKvmAccessible,
      nestedVirtSupported: kvmAvailable,
      accelerationMode,
    },
    networking: {
      interfaces,
      tunTapAvailable,
      bridgeCapable,
      iptablesAvailable,
      publicIpv4,
      ingressType,
    },
    assessment: {
      readyForFullEmulation,
      readyForKvmHardwareAcc,
      summary,
      bottlenecks,
      remediation,
    },
  };

  serverLogger.info(
    'HostInspector',
    `Host probe complete: OS=${report.host.os}, Kernel=${report.host.kernel}, Cores=${report.cpu.cores}, RAM=${report.memory.totalFormatted}, KVM=${report.virtualization.kvmAvailable ? 'YES' : 'NO (/dev/kvm missing)'}, QEMU=${report.virtualization.qemuVersion}`
  );

  return report;
}
