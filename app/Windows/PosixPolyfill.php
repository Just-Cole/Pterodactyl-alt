<?php

if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    if (!function_exists('posix_getpwuid')) {
        function posix_getpwuid($uid)
        {
            return [
                'name' => getenv('USERNAME') ?: 'WindowsUser',
                'passwd' => '',
                'uid' => $uid,
                'gid' => 0,
                'gecos' => '',
                'dir' => getenv('USERPROFILE'),
                'shell' => '',
            ];
        }
    }

    if (!function_exists('posix_getgrgid')) {
        function posix_getgrgid($gid)
        {
            return [
                'name' => 'WindowsGroup',
                'passwd' => '',
                'gid' => $gid,
                'members' => [],
            ];
        }
    }

    if (!function_exists('posix_getuid')) {
        function posix_getuid()
        {
            return 0;
        }
    }

    if (!function_exists('posix_getgid')) {
        function posix_getgid()
        {
            return 0;
        }
    }
}
