import { describe, expect, it } from "vitest";
import { adicionarTurnoInteligente, encontrarSobrepostos, minutesToTime, timeToMinutes } from "./horarioSemanaUtils.js";

const turno = (horaInicio, horaFim) => ({ horaInicio, horaFim });

describe("conversão de horários", () => {
  it("converte HH:MM e horários da API em minutos", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("18:00:00")).toBe(1080);
    expect(timeToMinutes()).toBe(0);
  });
  it("formata minutos e limita ao mesmo dia", () => {
    expect(minutesToTime(510)).toBe("08:30");
    expect(minutesToTime(-1)).toBe("00:00");
    expect(minutesToTime(1440)).toBe("23:59");
  });
});

describe("adicionarTurnoInteligente", () => {
  it.each([undefined, null, []])("inicia um dia sem turnos (%s)", (turnos) => {
    expect(adicionarTurnoInteligente(turnos)).toEqual([turno("08:00", "18:00")]);
  });
  it("divide o período integral com almoço sem modificar a entrada", () => {
    const entrada = Object.freeze([Object.freeze(turno("08:00", "18:00"))]);
    expect(adicionarTurnoInteligente(entrada)).toEqual([turno("08:00", "12:00"), turno("13:00", "18:00")]);
  });
  it.each([["08:00", "13:00"], ["15:00", "23:00"], ["00:00", "05:00"]])("divide períodos de 5h+ válidos (%s–%s)", (inicio, fim) => {
    const result = adicionarTurnoInteligente([turno(inicio, fim)]);
    expect(result).toHaveLength(2);
    expect(result[0].horaInicio).toBe(inicio);
    expect(result[1].horaFim).toBe(fim);
    expect(timeToMinutes(result[1].horaInicio) - timeToMinutes(result[0].horaFim)).toBe(60);
    result.forEach((t) => expect(timeToMinutes(t.horaFim)).toBeGreaterThan(timeToMinutes(t.horaInicio)));
    expect(encontrarSobrepostos(result).size).toBe(0);
  });
  it("preserva o turno curto e adiciona tarde com pausa de uma hora", () => {
    expect(adicionarTurnoInteligente([turno("08:00", "12:00")])).toEqual([turno("08:00", "12:00"), turno("13:00", "18:00")]);
  });
  it.each([["17:00", "18:00", "21:00"], ["18:00", "18:30", "21:30"]])("adiciona terceiro turno após %s", (fim, inicioNovo, fimNovo) => {
    const result = adicionarTurnoInteligente([turno("08:00", "12:00"), turno("13:00", fim)]);
    expect(result[2]).toEqual(turno(inicioNovo, fimNovo));
    expect(encontrarSobrepostos(result).size).toBe(0);
  });
  it("considera o término mais tarde mesmo com turnos fora de ordem", () => {
    expect(adicionarTurnoInteligente([turno("13:00", "18:00"), turno("08:00", "12:00")])[2]).toEqual(turno("18:30", "21:30"));
  });
  it("limita o novo turno ao fim do dia", () => {
    expect(adicionarTurnoInteligente([turno("08:00", "12:00"), turno("18:00", "22:00")])[2]).toEqual(turno("22:30", "23:00"));
  });
  it("divide o maior turno quando não cabe outro ao fim do dia", () => {
    const result = adicionarTurnoInteligente([turno("08:00", "12:00"), turno("20:00", "23:00")]);
    expect(result).toEqual([turno("08:00", "09:30"), turno("10:30", "12:00"), turno("20:00", "23:00")]);
    expect(encontrarSobrepostos(result).size).toBe(0);
  });
  it("preserva períodos curtos quando nenhuma divisão válida é possível", () => {
    const entrada = [turno("22:00", "22:30"), turno("23:00", "23:30")];
    expect(adicionarTurnoInteligente(entrada)).toEqual(entrada);
  });
  it("não cria um período vazio ao dividir apenas 61 minutos", () => {
    const entrada = [turno("21:00", "22:01"), turno("23:00", "23:30")];
    expect(adicionarTurnoInteligente(entrada)).toEqual(entrada);
  });
});
