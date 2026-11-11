"""Trusted transport harness. Workflow results remain untrusted application data."""
import importlib.util
import json
import os
import resource
import subprocess
import sys
import time

LIMIT = 2 * 1024 * 1024

def worker():
    resource.setrlimit(resource.RLIMIT_FSIZE, (LIMIT, LIMIT))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    os.chdir('/mnt/archil/code')
    sys.path.insert(0, '/mnt/archil/code')
    # Redirect file descriptors too: print(), native modules and os.write cannot
    # contaminate the parent's machine-readable stdout.
    with open('/tmp/workflow.log', 'w') as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
        if sys.argv[2] == 'test':
            import unittest
            suite = unittest.defaultTestLoader.discover('.', pattern='test_workflow.py')
            result = unittest.TextTestRunner(stream=log).run(suite)
            if result.testsRun == 0:
                raise RuntimeError('No generated tests were discovered')
            sys.exit(0 if result.wasSuccessful() else 1)
        with open(sys.argv[3]) as source:
            payload = json.load(source)
        spec = importlib.util.spec_from_file_location('workflow', 'workflow.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        output = module.run(payload)
        if not isinstance(output, dict):
            raise TypeError('workflow.run must return a JSON object')
        encoded = json.dumps(output, allow_nan=False)
        if len(encoded.encode()) > LIMIT:
            raise ValueError('Workflow output exceeds limit')
        with open('/tmp/workflow-output.json', 'w') as target:
            target.write(encoded)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'worker':
        worker()
    else:
        mode = sys.argv[1]
        if mode == 'batch':
            with open('/mnt/archil/io/input.json') as source:
                inputs = json.load(source)
            outputs = []
            deadline = time.monotonic() + 40
            for payload in inputs:
                with open('/tmp/case-input.json', 'w') as target:
                    json.dump(payload, target)
                if os.path.exists('/tmp/workflow-output.json'):
                    os.unlink('/tmp/workflow-output.json')
                completed = subprocess.run([sys.executable, '-I', __file__, 'worker', 'run', '/tmp/case-input.json'],
                                           timeout=max(0.01, deadline-time.monotonic()),
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if completed.returncode != 0:
                    print(json.dumps({'exitCode': completed.returncode, 'stderr': 'Workflow case failed', 'stdout': ''}))
                    sys.exit(0)
                with open('/tmp/workflow-output.json') as source:
                    outputs.append(json.load(source))
                if len(json.dumps(outputs).encode()) > LIMIT:
                    raise ValueError('Batch output exceeds limit')
            print(json.dumps({'exitCode': 0, 'outputs': outputs, 'stdout': '', 'stderr': ''}, allow_nan=False))
            sys.exit(0)
        completed = subprocess.run([sys.executable, '-I', __file__, 'worker', mode, '/mnt/archil/io/input.json'], timeout=40,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log = ''
        if os.path.exists('/tmp/workflow.log'):
            with open('/tmp/workflow.log') as stream:
                log = stream.read(65536)
        envelope = {'exitCode': completed.returncode, 'stdout': log, 'stderr': ''}
        if mode == 'run' and completed.returncode == 0:
            with open('/tmp/workflow-output.json') as stream:
                envelope['output'] = json.load(stream)
        print(json.dumps(envelope, allow_nan=False))
