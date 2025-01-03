/** @type {{[node: string]: {[arg: string]: string}}} */
const nodes = {
    Grammar:{
        rules: 'Producciones[]',
        globalCode: '?{before: string; after?: string}',
    },
    Producciones:{
        id: 'string',
        expr: 'Opciones',
        alias: '?string',
        start: '?boolean',
    },
    Opciones: { exprs: 'Union[]'},
    Union: { 
        exprs: 'Node[]',
        action: '?Predicate',
    },
    Predicate:{
        returnType: 'string',
        code: 'string',
        params: '{ [label: string]: string }',
    },
    Pluck: {labeledExpr: 'Label', pluck: '?boolean'},
    Label: {annotatedExpr: 'Annotated', label: '?string'},
    Annotated: {expr: 'Node', qty: '?(string|Node)', text: '?boolean'},
    Assertion: {assertion: 'Node'},
    NegAssertion: {assertion: 'Node'},
    String: { val: 'string', isCase: '?boolean' },
    Corchetes: { chars: '(LiteralRango|Rango)[]', isCase: '?boolean' },
    Rango: { bottom: 'string', top: 'string', isCase: '?boolean' },
    LiteralRango:{val:'string', isCase: '?boolean'},
    DelimiterCount: {count: 'Node', expr: '?Node'},
    DelimiterMinMax: {min: '?Node', max: '?Node', expr: '?Node'},
    NumberDelimiter: {val: 'string'},
    Identificador: { id: 'string' },
    Grupo: {expr: 'Opciones'},
    Any: {},
    FinCadena:{}
 };
 
 export default nodes;