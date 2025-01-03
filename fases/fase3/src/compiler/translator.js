import * as CST from '../visitor/CST.js';
import * as Template from '../Templates.js';
import { getActionId, getReturnType, getExprId, getRuleId } from './utils.js';

/** @typedef {import('../visitor/Visitor.js').default<string>} Visitor */
/** @typedef {import('../visitor/Visitor.js').ActionTypes} ActionTypes*/

/**
 * @implements {Visitor}
 */
export default class FortranTranslator {
    /** @type {ActionTypes} */
    actionReturnTypes;
    /** @type {string[]} */
    actions;
    /** @type {boolean} */
    translatingStart;
    /** @type {string} */
    currentRule;
    /** @type {number} */
    currentChoice;
    /** @type {number} */
    currentExpr;
    /** @type {number} */
    nameGroup;
    /**
     * @type {string[]}
     */
    groupsFunction;

    /**
     *
     * @param {ActionTypes} returnTypes
     */
    constructor(returnTypes) {
        this.actionReturnTypes = returnTypes;
        this.actions = [];
        this.translatingStart = false;
        this.currentRule = '';
        this.currentChoice = 0;
        this.currentExpr = 0;
        this.nameGroup = 0;
        this.groupsFunction = [];
    }

    /**
     * @param {CST.Grammar} node
     * @this {Visitor}
     */
    visitGrammar(node) {
        const rules = node.rules.map((rule) => rule.accept(this));
        
        return Template.main({
            beforeContains: node.globalCode?.before ?? '',
            afterContains: node.globalCode?.after ?? '',
            startingRuleId: getRuleId(node.rules[0].id),
            startingRuleType: getReturnType(
                getActionId(node.rules[0].id, 0),
                this.actionReturnTypes
            ),
            groups: this.groupsFunction,
            actions: this.actions,
            rules,
        });
    }

    /**
     * @param {CST.Producciones} node
     * @this {Visitor}
     */
    visitProducciones(node) {
        this.currentRule = node.id;
        this.currentChoice = 0;

        if (node.start) this.translatingStart = true;

        const ruleTranslation = Template.rule({
            id: node.id,
            returnType: getReturnType(
                getActionId(node.id, this.currentChoice),
                this.actionReturnTypes
            ),
            exprDeclarations: node.expr.exprs.flatMap((election, i) =>
                election.exprs
                    .filter((expr) => expr instanceof CST.Pluck)
                    .map((label, j) => {
                        const expr = label.labeledExpr.annotatedExpr.expr;
                        return `${
                            expr instanceof CST.Identificador
                                ? getReturnType(
                                      getActionId(expr.id, i),
                                      this.actionReturnTypes
                                  )
                                : 'character(len=:), allocatable'
                        } :: expr_${i}_${j}`;
                    })
            ),
            delimiterIndex: node.expr.exprs.flatMap((election, i) =>
                election.exprs
                    .filter((expr) => expr instanceof CST.Pluck)
                    .map((label, j) => {
                        const expr = label.labeledExpr.annotatedExpr;
                        if(expr.qty && typeof expr.qty !== 'string'){
                            return  `integer :: delimiter_iterator_${i}_${j}`;
                        }else{
                            return '';
                        }
                    
                    })
            ),

            expr: node.expr.accept(this),
        });

        this.translatingStart = false;

        return ruleTranslation;
    }

    /**
     * @param {CST.Opciones} node
     * @this {Visitor}
     */
    visitOpciones(node) {
        return Template.election({
            exprs: node.exprs.map((expr) => {
                const translation = expr.accept(this);
                this.currentChoice++;
                return translation;
            }),
        });
    }

    /**
     * @param {CST.Union} node
     * @this {Visitor}
     */
    visitUnion(node) {
        const matchExprs = node.exprs.filter(
            (expr) => expr instanceof CST.Pluck
        );
        const exprVars = matchExprs.map(
            (_, i) => `expr_${this.currentChoice}_${i}`
        );

        /** @type {string[]} */
        let neededExprs;
        /** @type {string} */
        let resultExpr;
        const currFnId = getActionId(this.currentRule, this.currentChoice);
        if (currFnId in this.actionReturnTypes) {
            neededExprs = exprVars.filter(
                (_, i) => matchExprs[i].labeledExpr.label
            );
            resultExpr = Template.fnResultExpr({
                fnId: getActionId(this.currentRule, this.currentChoice),
                exprs: neededExprs.length > 0 ? neededExprs : [],
            });
        } else {
            neededExprs = exprVars.filter((_, i) => matchExprs[i].pluck);
            resultExpr = Template.strResultExpr({
                exprs: neededExprs.length > 0 ? neededExprs : exprVars,
            });
        }
        this.currentExpr = 0;

        if (node.action) this.actions.push(node.action.accept(this));
        return Template.union({
            exprs: node.exprs.map((expr) => {
                const translation = expr.accept(this);
                if (expr instanceof CST.Pluck) this.currentExpr++;
                return translation;
            }),
            startingRule: this.translatingStart,
            resultExpr,
        });
    }

    /**
     * @param {CST.Pluck} node
     * @this {Visitor}
     */
    visitPluck(node) {
        return node.labeledExpr.accept(this);
    }

    /**
     * @param {CST.Label} node
     * @this {Visitor}
     */
    visitLabel(node) {
        return node.annotatedExpr.accept(this);
    }

    /**
     * @param {CST.Annotated} node
     * @this {Visitor}
     */
    visitAnnotated(node) {
        if (node.qty && typeof node.qty === 'string') {
            if (node.expr instanceof CST.Identificador) {
                // TODO: Implement quantifiers (i.e., ?, *, +)
                return `${getExprId(
                    this.currentChoice,
                    this.currentExpr
                )} = ${node.expr.accept(this)}`;
            }
            return Template.strExpr({
                quantifier: node.qty,
                expr: node.expr.accept(this),
                destination: getExprId(this.currentChoice, this.currentExpr),
            });
        } else if (node.qty) {
            if(node.qty instanceof CST.DelimiterCount){
                let exprIterator;
                if(node.qty.count instanceof CST.NumberDelimiter){
                    exprIterator = node.qty.count.accept(this);
                }else{
                    //NO PUDE IMPLEMENTARLO
                    exprIterator = "5";
                }
                return Template.strExprDelimiter({
                    
                    exprIterator: exprIterator,
                    iterador: `delimiter_iterator_${this.currentChoice}_${this.currentExpr}`,
                    expr: node.expr.accept(this),
                    delimiter: node.qty.expr? node.qty.expr.accept(this): '',
                    destination: getExprId(this.currentChoice, this.currentExpr),
                });

            }

            if(node.qty instanceof CST.DelimiterMinMax){
                let exprIteratorMin;
                if(node.qty.min instanceof CST.NumberDelimiter){
                    exprIteratorMin = node.qty.min.accept(this);
                }else{
                    //NO PUDE IMPLEMENTARLO
                    exprIteratorMin = "1";
                }

                let exprIteratorMax;
                if( node.qty.max instanceof CST.NumberDelimiter){
                    exprIteratorMax = node.qty.max.accept(this);
                }else{
                    //NO PUDE IMPLEMENTARLO
                    exprIteratorMax = "5";
                }

                
                return Template.strExprDelimiterMinMax({
                    exprIteratorMin: exprIteratorMin,
                    exprIteratorMax: exprIteratorMax,
                    iterador: `delimiter_iterator_${this.currentChoice}_${this.currentExpr}`,
                    expr: node.expr.accept(this),
                    delimiter: node.qty.expr? node.qty.expr.accept(this): '',
                    destination: getExprId(this.currentChoice, this.currentExpr),
                });
            
            }
            // TODO: Implement repetitions (e.g., |3|, |1..3|, etc...)
            //throw new Error('Repetitions not implemented.');
        } else {
            if (node.expr instanceof CST.Identificador) {
                return `${getExprId(
                    this.currentChoice,
                    this.currentExpr
                )} = ${node.expr.accept(this)}`;
            }

            if(node.expr instanceof CST.Grupo){
                
                let nameGroup = "group"+this.nameGroup;
                let temp = this.currentChoice;
                let temp2 = this.currentExpr;
                this.groupsFunction.push(node.expr.accept(this));
                this.currentChoice = temp;
                this.currentExpr = temp2;
                return `${getExprId(
                    this.currentChoice,
                    this.currentExpr
                )} = peg_${nameGroup}()`;
               
            }
            return Template.strExpr({
                expr: node.expr.accept(this),
                destination: getExprId(this.currentChoice, this.currentExpr),
            });
        }
    }

    /**
     * @param {CST.Assertion} node
     * @this {Visitor}
     */
    visitAssertion(node) {
        if (node.assertion instanceof CST.Predicate) return ""
        return `\t\t\t\tif(.not. ${node.assertion.accept(this)}) cycle`
    }

    /**
     * @param {CST.NegAssertion} node
     * @this {Visitor}
     */
    visitNegAssertion(node) {        
        if (node.assertion instanceof CST.Predicate) return ""
        return `\t\t\t\tif(${node.assertion.accept(this)}) cycle`
    }

    /**
     * @param {CST.Predicate} node
     * @this {Visitor}
     */
    visitPredicate(node) {
        return Template.action({
            ruleId: this.currentRule,
            choice: this.currentChoice,
            signature: Object.keys(node.params),
            returnType: node.returnType,
            paramDeclarations: Object.entries(node.params).map(
                ([label, ruleId]) =>
                    `${getReturnType(
                        getActionId(ruleId, this.currentChoice),
                        this.actionReturnTypes
                    )} :: ${label}`
            ),
            code: node.code,
        });
    }

    /**
     * @param {CST.String} node
     * @this {Visitor}
     */
    visitString(node) {
        const literalMap = {
            "\\t": "char(9)",  // Tabulación
            "\\n": "char(10)", // Nueva línea
            " ": "char(32)",   // Espacio
            "\\r": "char(13)",  // Retorno de carro
        };
        const literalFortran = literalMap[node.val] || `'${node.val}'`;

        if (node.isCase) {
            return `acceptString(${literalFortran}, 1)`;
        }
        return `acceptString(${literalFortran}, 0)`;
    }
    
    /**
     * @param {CST.Corchetes} node
     * @this {Visitor}
     */
    visitCorchetes(node) {
        node.chars.forEach(expr => { expr.isCase = node.isCase });
        let isCase = node.isCase ? 1 : 0;
        let characterClass = [];
        const literales = node.chars
        .filter((char) => char instanceof CST.LiteralRango)
        .map((char) => char.accept(this));

        const ranges = node.chars
        .filter((char) => char instanceof CST.Rango)
        .map((char) => char.accept(this));

        if (literales.length !== 0) {
            characterClass = [`acceptSet([ ${literales.join(',')} ], ${isCase})`];
        }
        if (ranges.length !== 0) {
            characterClass = [...characterClass, ...ranges];
        }

        return characterClass.join(' .or. ');

    }

    /**
     * @param {CST.Rango} node
     * @this {Visitor}
     */
    visitRango(node) {
        if (node.isCase) {
            return `acceptRange('${node.bottom}', '${node.top}', 1)`;
        }
        return `acceptRange('${node.bottom}', '${node.top}', 0)`;
    }

    /**
     * @param {CST.LiteralRango} node
     * @this {Visitor}
     */

    visitLiteralRango(node) {
        const literalMap = {
            "\\t": "char(9)",  // Tabulación
            "\\n": "char(10)", // Nueva línea
            " ": "char(32)",   // Espacio
            "\\r": "char(13)",  // Retorno de carro
        };
        const literalFortran = literalMap[node.val] || (node.isCase? `tolower('${node.val}')`:`'${node.val}'`);
        return literalFortran;
    }

    /**
     * @param {CST.Grupo} node
     * @this {Visitor}
     */
    visitGrupo(node) {
        let tempT = this.translatingStart;
        this.translatingStart = false;
        let nameGrupo = "group"+this.nameGroup;
        this.currentRule = nameGrupo;
        
        this.currentChoice = 0;


        const ruleTranslation = Template.rule({
            id:nameGrupo,
            returnType: getReturnType(
                getActionId(nameGrupo, this.currentChoice),
                this.actionReturnTypes
            ),
            exprDeclarations: node.expr.exprs.flatMap((election, i) =>
                election.exprs
                    .filter((expr) => expr instanceof CST.Pluck)
                    .map((label, j) => {
                        const expr = label.labeledExpr.annotatedExpr.expr;
                        return `${
                            expr instanceof CST.Identificador
                                ? getReturnType(
                                      getActionId(expr.id, i),
                                      this.actionReturnTypes
                                  )
                                : 'character(len=:), allocatable'
                        } :: expr_${i}_${j}`;
                    })
            ),
            delimiterIndex: node.expr.exprs.flatMap((election, i) =>
                election.exprs
                    .filter((expr) => expr instanceof CST.Pluck)
                    .map((label, j) => {
                        const expr = label.labeledExpr.annotatedExpr;
                        if(expr.qty && typeof expr.qty !== 'string'){
                            return  `integer :: delimiter_iterator_${i}_${j}`;
                        }else{
                            return '';
                        }
                    
                    })
            ),

            expr: node.expr.accept(this),
        });

        this.nameGroup++;
        this.translatingStart = tempT;
        return ruleTranslation;
        //return node.expr.accept(this);
    }

    /**
     * @param {CST.Identificador} node
     * @this {Visitor}
     */
    visitIdentificador(node) {
        return getRuleId(node.id) + '()';
    }
    /**
     * @param {CST.Any} node
     * @this {Visitor}
     */
    visitAny(node) {
        return 'acceptPeriod()';
    }
    /**
     * @param {CST.FinCadena} node
     * @this {Visitor}
     */
    visitFinCadena(node) {
        return 'if (.not. acceptEOF()) cycle';
    }

    /**
     * @param {CST.DelimiterCount} node
     * @this {Visitor}
     */
    visitDelimiterCount(node) {
         throw new Error('Method not implemented.');
    }

    /**
     * @param {CST.DelimiterMinMax} node
     * @this {Visitor}
     */
    visitDelimiterMinMax(node) {
         throw new Error('Method not implemented.');
    }

    /**
     * @param {CST.NumberDelimiter} node
     * @this {Visitor}
     */
    visitNumberDelimiter(node) {
         return node.val;
    }
}