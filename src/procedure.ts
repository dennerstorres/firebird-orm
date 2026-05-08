/**
 * Define o tipo de Stored Procedure no Firebird.
 * - `selectable`: Retorna múltiplas linhas, chamada via `SELECT * FROM PROCEDURE`.
 * - `executable`: Executa uma ação e pode retornar uma única linha, chamada via `EXECUTE PROCEDURE`.
 */
export type ProcedureType = 'selectable' | 'executable';

/**
 * Utilitário para construção de comandos SQL para Stored Procedures do Firebird.
 *
 * @remarks
 * **Firebird quirk:** O Firebird diferencia procedures que retornam conjuntos de dados (selectable)
 * daquelas que apenas executam uma lógica ou retornam valores únicos (executable).
 */
export class ProcedureBuilder {
  /**
   * Constrói o comando SQL e prepara os parâmetros para a execução de uma procedure.
   *
   * @param name - Nome da Stored Procedure no banco de dados.
   * @param params - Lista de parâmetros de entrada.
   * @param type - Tipo da procedure (`executable` por padrão).
   * @returns Um objeto contendo a string SQL formatada e o array de parâmetros.
   *
   * @example
   * ```typescript
   * const { sql, params } = ProcedureBuilder.build('SP_CALCULA_FRETE', [10, '01001-000']);
   * // sql: "EXECUTE PROCEDURE SP_CALCULA_FRETE(?, ?)"
   * ```
   *
   * @example
   * ```typescript
   * const { sql, params } = ProcedureBuilder.build('SP_LISTAR_PRODUTOS', [1], 'selectable');
   * // sql: "SELECT * FROM SP_LISTAR_PRODUTOS(?)"
   * ```
   */
  static build(
    name: string,
    params: unknown[] = [],
    type: ProcedureType = 'executable'
  ): { sql: string; params: unknown[] } {
    const sqlName = name.toUpperCase();
    const placeholders = params.length > 0 ? `(${params.map(() => '?').join(', ')})` : '';

    if (type === 'selectable') {
      return {
        sql: `SELECT * FROM ${sqlName}${placeholders}`,
        params,
      };
    }

    return {
      sql: `EXECUTE PROCEDURE ${sqlName}${placeholders}`,
      params,
    };
  }
}
