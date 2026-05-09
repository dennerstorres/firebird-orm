import { EventEmitter } from 'events';

/**
 * Utilitário para resolução de campos BLOB no Firebird.
 * O node-firebird retorna BLOBs como uma função que aceita um callback.
 */

/**
 * Resolve uma função de BLOB do Firebird para um Buffer.
 *
 * @param blob - A função de BLOB retornada pelo driver node-firebird.
 * @returns Uma Promise que resolve com os dados do BLOB em um Buffer.
 *
 * @example
 * ```typescript
 * const buffer = await resolveBlob(row.CAMPO_BLOB);
 * ```
 *
 * @remarks
 * **Firebird quirk:** Campos BLOB não vêm como Buffer ou string diretamente;
 * eles são retornados como uma função de stream que deve ser consumida.
 */
export async function resolveBlob(blob: Function): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    blob((err: Error, _name: string, e: EventEmitter) => {
      if (err) return reject(err);

      const chunks: Buffer[] = [];

      e.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      e.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      e.on('error', (err: Error) => {
        reject(err);
      });
    });
  });
}
