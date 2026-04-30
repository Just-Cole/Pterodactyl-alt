using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;

namespace WingsWin.System
{
    class JobRunner
    {
        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public Int64 PerProcessUserTimeLimit;
            public Int64 PerJobUserTimeLimit;
            public UInt32 LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public UInt32 ActiveProcessLimit;
            public UIntPtr Affinity;
            public UInt32 PriorityClass;
            public UInt32 SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public UInt64 ReadOperationCount;
            public UInt64 WriteOperationCount;
            public UInt64 OtherOperationCount;
            public UInt64 ReadTransferCount;
            public UInt64 WriteTransferCount;
            public UInt64 OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoCounters;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_CPU_RATE_CONTROL_INFORMATION
        {
            public UInt32 ControlFlags;
            public UInt32 CpuRate;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll")]
        static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll")]
        static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        const int JobObjectExtendedLimitInformation = 9;
        const int JobObjectCpuRateControlInformation = 15;
        const uint JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100;
        const uint JOB_OBJECT_CPU_RATE_CONTROL_ENABLE = 0x00000001;
        const uint JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP = 0x00000004;

        static void Main(string[] args)
        {
            if (args.Length < 4)
            {
                Console.WriteLine("Usage: JobRunner.exe [memory_mb] [cpu_percent] [working_dir] [executable] [args...]");
                return;
            }

            long memoryLimitMb = long.Parse(args[0]);
            int cpuLimitPercent = int.Parse(args[1]);
            string workingDir = args[2];
            string executable = args[3];
            string arguments = args.Length > 4 ? string.Join(" ", args, 4, args.Length - 4) : "";

            IntPtr hJob = CreateJobObject(IntPtr.Zero, "WingsWinJob_" + Guid.NewGuid().ToString());

            // Memory Limit
            if (memoryLimitMb > 0)
            {
                var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_PROCESS_MEMORY;
                info.ProcessMemoryLimit = new UIntPtr((ulong)memoryLimitMb * 1024 * 1024);
                
                int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                IntPtr ptr = Marshal.AllocHGlobal(length);
                Marshal.StructureToPtr(info, ptr, false);
                SetInformationJobObject(hJob, JobObjectExtendedLimitInformation, ptr, (uint)length);
                Marshal.FreeHGlobal(ptr);
            }

            // CPU Limit
            if (cpuLimitPercent > 0 && cpuLimitPercent < 100)
            {
                var cpuInfo = new JOBOBJECT_CPU_RATE_CONTROL_INFORMATION();
                cpuInfo.ControlFlags = JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP;
                cpuInfo.CpuRate = (uint)(cpuLimitPercent * 100); // 10000 = 100%

                int length = Marshal.SizeOf(typeof(JOBOBJECT_CPU_RATE_CONTROL_INFORMATION));
                IntPtr ptr = Marshal.AllocHGlobal(length);
                Marshal.StructureToPtr(cpuInfo, ptr, false);
                SetInformationJobObject(hJob, JobObjectCpuRateControlInformation, ptr, (uint)length);
                Marshal.FreeHGlobal(ptr);
            }

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = arguments,
                WorkingDirectory = workingDir,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            // NOTE: Full AppContainer implementation would require CreateProcessInternalW
            // For now, we rely on the parent (Daemon) to set directory ACLs and the Job Object 
            // provides the primary resource isolation.

            Process proc = Process.Start(psi);
            AssignProcessToJobObject(hJob, proc.Handle);

            proc.OutputDataReceived += (s, e) => { if (e.Data != null) Console.WriteLine(e.Data); };
            proc.ErrorDataReceived += (s, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();

            proc.WaitForExit();
        }
    }
}
