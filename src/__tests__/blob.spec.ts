import { resolveBlob } from '../blob';
import { EventEmitter } from 'events';

describe('resolveBlob', () => {
  it('should resolve a Firebird BLOB callback into a Buffer', async () => {
    const mockData = Buffer.from('Hello, Firebird BLOB!');

    const mockBlob = (callback: Function) => {
      const emitter = new EventEmitter();
      callback(null, 'mock_blob', emitter);

      // Simulate data streaming
      setImmediate(() => {
        emitter.emit('data', mockData.slice(0, 7));
        emitter.emit('data', mockData.slice(7));
        emitter.emit('end');
      });
    };

    const result = await resolveBlob(mockBlob);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('Hello, Firebird BLOB!');
  });

  it('should reject if the BLOB callback returns an error', async () => {
    const mockBlob = (callback: Function) => {
      callback(new Error('Failed to open BLOB'), null, null);
    };

    await expect(resolveBlob(mockBlob)).rejects.toThrow('Failed to open BLOB');
  });

  it('should reject if the stream emits an error', async () => {
    const mockBlob = (callback: Function) => {
      const emitter = new EventEmitter();
      callback(null, 'mock_blob', emitter);

      setImmediate(() => {
        emitter.emit('error', new Error('Stream error'));
      });
    };

    await expect(resolveBlob(mockBlob)).rejects.toThrow('Stream error');
  });
});
