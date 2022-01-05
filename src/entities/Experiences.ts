import { Entity, Property, PrimaryKey } from '@mikro-orm/core';

@Entity()
export class Experiences {
	@PrimaryKey()
		id!: number;
	@Property({ columnType: 'INTEGER', nullable: false })
		level!: string;

	@Property({ fieldName: 'userID', columnType: 'STRING', nullable: false })
		userID!: string;

	@Property({ fieldName: 'guildID', columnType: 'STRING', nullable: false })
		guildID!: string;

	@Property({ columnType: 'INTEGER', nullable: false })
		exp!: number;
}
