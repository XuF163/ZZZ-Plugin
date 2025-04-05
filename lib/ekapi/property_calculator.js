export class PropertyCalculator {
    /**
     * @param {number} baseHp 角色+武器的基础生命值
     * @param {number} baseAtk 角色+武器的基础攻击力
     * @param {number} baseDef 角色+武器的基础防御力
     * @param {object} props 包含非基础三维的直接累加属性的对象 (e.g., { Crit: 500, CritDmg: 5000, SpRecoverPercent: 10000, ... })
     * @param {object} percentAdds 包含基础三维百分比加成的对象 (e.g., { HpAdd: 1500, AttackAdd: 500, DefenceAdd: 0 })
     * @param {object} flatAdds 包含基础三维固定值加成的对象 (e.g., { HpMax: 500, Attack: 100, Defence: 50 })
     */
    constructor(baseHp, baseAtk, baseDef, props, percentAdds, flatAdds) {
        this.baseHp = baseHp;
        this.baseAtk = baseAtk;
        this.baseDef = baseDef;
        this.props = props || {};
        this.percentAdds = percentAdds || { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
        this.flatAdds = flatAdds || { HpMax: 0, Attack: 0, Defence: 0 };
         }
    getFormattedHpMax() {
        return "暂无ck，请先【#扫码登录】";
    }
    getFormattedAttack() {
        return "0";
    }
    getFormattedDefence() {
        return "0";
    }
    getFormattedBreakStun() {
        return "0";
    }
    getFormattedCrit() {
        return "0.0%";
    }
    getFormattedCritDmg() {
        return "0.0%";
    }
    getFormattedElementAbnormalPower() {
        return "0";
    }
    getFormattedElementMystery() {
        return "0";
    }
    getFormattedPenRate() {
        return "0.0%";
    }
    getFormattedSpRecoverPercent() {
        return "0.0%";
    }
    getFormattedPenDelta() {
        return "0";
    }
    getFormattedPhysDmgBonus() {
        return "0.0%";
    }
    getFormattedFireDmgBonus() {
        return "0.0%";
    }
    getFormattedIceDmgBonus() {
        return "0.0%";
    }
    getFormattedThunderDmgBonus() {
        return "0.0%";
    }
    getFormattedEtherDmgBonus() {
        return "0.0%";
    }
}
