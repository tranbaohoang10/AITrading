"""OS limits for the trusted PB-011 worker; never an arbitrary-code sandbox."""
import os

MEMORY_BYTES = 512 * 1024 * 1024
CPU_SECONDS = 20
_job_handle = None  # Keep the Windows job alive until this process exits.


def apply_limits(memory_bytes=MEMORY_BYTES, cpu_seconds=CPU_SECONDS):
    if os.name == 'nt':
        _windows(memory_bytes, cpu_seconds)
    elif os.name == 'posix':
        import resource
        for kind, maximum in ((resource.RLIMIT_AS, memory_bytes),
                              (resource.RLIMIT_CPU, cpu_seconds),
                              (resource.RLIMIT_CORE, 0), (resource.RLIMIT_FSIZE, 0),
                              (resource.RLIMIT_NOFILE, 32)):
            _, hard = resource.getrlimit(kind)
            bound = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
            resource.setrlimit(kind, (bound, bound))
    else:
        raise RuntimeError('WORKER_RESOURCE_UNAVAILABLE')


def _windows(memory_bytes, cpu_seconds):
    import ctypes as c
    from ctypes import wintypes as w
    global _job_handle

    class Basic(c.Structure):
        _fields_ = [('process_time', c.c_longlong), ('job_time', c.c_longlong),
                    ('flags', w.DWORD), ('min_working', c.c_size_t),
                    ('max_working', c.c_size_t), ('active', w.DWORD),
                    ('affinity', c.c_size_t), ('priority', w.DWORD), ('scheduling', w.DWORD)]

    class Io(c.Structure):
        _fields_ = [(name, c.c_ulonglong) for name in
                    ('reads', 'writes', 'others', 'read_bytes', 'write_bytes', 'other_bytes')]

    class Extended(c.Structure):
        _fields_ = [('basic', Basic), ('io', Io), ('process_memory', c.c_size_t),
                    ('job_memory', c.c_size_t), ('peak_process', c.c_size_t), ('peak_job', c.c_size_t)]

    kernel = c.WinDLL('kernel32', use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [c.c_void_p, w.LPCWSTR]
    kernel.CreateJobObjectW.restype = w.HANDLE
    kernel.SetInformationJobObject.argtypes = [w.HANDLE, c.c_int, c.c_void_p, w.DWORD]
    kernel.SetInformationJobObject.restype = w.BOOL
    kernel.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    kernel.AssignProcessToJobObject.restype = w.BOOL
    kernel.GetCurrentProcess.argtypes = []
    kernel.GetCurrentProcess.restype = w.HANDLE
    kernel.CloseHandle.argtypes = [w.HANDLE]
    kernel.CloseHandle.restype = w.BOOL
    handle = kernel.CreateJobObjectW(None, None)
    if not handle:
        raise RuntimeError('WORKER_RESOURCE_UNAVAILABLE')
    limits = Extended()
    limits.basic.flags = 0x2 | 0x8 | 0x100 | 0x2000  # CPU, active count, committed memory, kill on close
    limits.basic.process_time = cpu_seconds * 10_000_000  # Windows 100ns units
    limits.basic.active = 1
    limits.process_memory = memory_bytes
    if not kernel.SetInformationJobObject(handle, 9, c.byref(limits), c.sizeof(limits)):
        kernel.CloseHandle(handle)
        raise RuntimeError('WORKER_RESOURCE_UNAVAILABLE')
    if not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
        kernel.CloseHandle(handle)
        raise RuntimeError('WORKER_RESOURCE_UNAVAILABLE')
    _job_handle = handle
