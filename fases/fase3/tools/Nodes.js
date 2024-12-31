/** @type {{[node: string]: {[arg: string]: string}}} */

const nodes = {
    Producciones: {
        id: 'string',
        expr: 'Opciones',
        alias: '?string',
        start: '?boolean',
    },
    Opciones: { exprs: 'Union[]'},
    Union: { exprs: 'Expresion[]' },
    Expresion: { expr: 'Node', label: '?string', qty: '?string' },
    String: { val: 'string', isCase: '?boolean' },
    Any: {},
    Corchetes: { chars: '(literalRango|rango)[]', isCase: '?boolean' },
    rango: { bottom: 'string', top: 'string' },
    literalRango:{val:'string'},
    identificador: { id: 'string' },
    grupo: {expr: 'Opciones'},
    finCadena:{}
 };
 
 export default nodes;

